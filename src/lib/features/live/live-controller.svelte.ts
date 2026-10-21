import {
	abandonMatch,
	addGuestAndCheckIn,
	changeParticipantStatus,
	checkInPlayer,
	checkInPlayers,
	completeSet,
	closeSession,
	correctCompletedSet,
	saveRotationRecommendation,
	startMatch,
	setLeaveAfterMatch,
	substitutePlayer,
	type ActiveMatch,
	type LiveSession,
	liveSessionQueryKey,
	emptyLiveSessionSnapshot,
	type LiveSessionSnapshot
} from '$lib/data/live';
import type { QueryClient } from '@tanstack/svelte-query';
import type { Participant, ParticipantStatus } from '$lib/domain/types';
import { recommendNextPlayers, STARVATION_POLICIES } from '$lib/domain/rotation';
import type { RotationRecommendation } from '$lib/domain/rotation/types';
import type { PairingOption } from '$lib/domain/rating';

type Notice = (message: string) => void;
type RunMutation = (
	action: () => Promise<unknown>,
	invalidateLive: boolean,
	waitForRefresh?: boolean
) => Promise<unknown>;

function errorMessage(error: unknown, fallback: string) {
	if (error instanceof Error) return error.message;
	if (error && typeof error === 'object' && 'message' in error) {
		const message = error.message;
		if (typeof message === 'string' && message) {
			const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
			const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : '';
			return [message, details, hint].filter(Boolean).join(' — ');
		}
	}
	return fallback;
}

export class LiveController {
	adminAuthorized = $state(false);
	pending = $state('');
	online = $state(true);

	constructor(
		private readonly notify: Notice,
		private readonly queryClient: QueryClient,
		private readonly runMutation: RunMutation = (action) => action(),
		private readonly queryKey: readonly string[] = liveSessionQueryKey
	) {}

	private get snapshot() {
		return (
			this.queryClient.getQueryData<LiveSessionSnapshot>(this.queryKey) ?? emptyLiveSessionSnapshot
		);
	}

	get session(): LiveSession | null {
		return this.snapshot.session;
	}

	set session(session: LiveSession | null) {
		this.queryClient.setQueryData<LiveSessionSnapshot>(this.queryKey, (current) => ({
			...(current ?? emptyLiveSessionSnapshot),
			session
		}));
	}

	get participants(): Participant[] {
		return this.snapshot.participants;
	}

	set participants(participants: Participant[]) {
		this.queryClient.setQueryData<LiveSessionSnapshot>(this.queryKey, (current) => ({
			...(current ?? emptyLiveSessionSnapshot),
			participants
		}));
	}

	get activeMatch(): ActiveMatch | null {
		return this.snapshot.activeMatch;
	}

	set activeMatch(activeMatch: ActiveMatch | null) {
		this.queryClient.setQueryData<LiveSessionSnapshot>(this.queryKey, (current) => ({
			...(current ?? emptyLiveSessionSnapshot),
			activeMatch
		}));
	}

	get canManage() {
		return this.adminAuthorized;
	}

	setAdminAuthorized(authorized: boolean) {
		this.adminAuthorized = authorized;
	}

	setOnline(online: boolean) {
		this.online = online;
	}

	async refresh() {
		await this.queryClient.invalidateQueries({ queryKey: this.queryKey }, { cancelRefetch: false });
	}

	private async runCommand(label: string, action: () => Promise<unknown>, waitForRefresh = true) {
		if (this.pending) return false;
		if (!this.online) {
			this.notify('Koneksi terputus. Menampilkan kondisi sesi terakhir yang tersimpan.');
			return false;
		}
		this.pending = label;
		try {
			await this.runMutation(action, true, waitForRefresh);
			return true;
		} catch (error) {
			this.notify(errorMessage(error, 'Perubahan belum tersimpan. Coba lagi.'));
			return false;
		} finally {
			this.pending = '';
		}
	}

	checkIn(playerId: string) {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		return this.runCommand('Mencatat pemain hadir…', () =>
			checkInPlayer(this.session!.id, playerId)
		);
	}

	checkInMany(playerIds: string[]) {
		if (!this.session || !this.adminAuthorized || !playerIds.length) return Promise.resolve(false);
		return this.runCommand(`Mencatat ${playerIds.length} pemain hadir…`, () =>
			checkInPlayers(this.session!.id, playerIds)
		);
	}

	addGuest(name: string) {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		return this.runCommand('Menambahkan pemain tamu…', () =>
			addGuestAndCheckIn(this.session!.id, name)
		);
	}

	setStatus(participantId: string, status: ParticipantStatus) {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		return this.runCommand('Memperbarui status pemain…', () =>
			changeParticipantStatus(this.session!.id, participantId, status)
		);
	}

	get nextRecommendation(): RotationRecommendation | null {
		if (!this.session || !this.adminAuthorized || this.activeMatch) return null;
		const ready = this.participants.filter((participant) => participant.status === 'READY');
		if (ready.length < 4) return null;
		return recommendNextPlayers(
			ready.map((participant) => ({
				id: participant.id,
				name: participant.name,
				status: participant.status,
				readySinceMs: participant.readySince?.getTime() ?? null,
				eligibleOpportunities: participant.opportunities,
				missedOpportunities: participant.missedOpportunities,
				currentOpportunityDebt: participant.currentOpportunityDebt,
				setsPlayed: participant.setsPlayed,
				consecutiveRotations: participant.consecutiveMatches,
				rotationsPlayed: participant.rotationsPlayed
			})),
			Date.now(),
			undefined,
			STARVATION_POLICIES.DEBT_4_OR_WAIT_45
		);
	}
	async prepareNextMatch(): Promise<{ id: string; recommendation: RotationRecommendation } | null> {
		if (this.pending || !this.online) return null;
		const recommendation = this.nextRecommendation;
		if (!recommendation) return null;
		this.pending = 'Menyiapkan rekomendasi…';
		try {
			const id = (await this.runMutation(
				() => saveRotationRecommendation(this.session!.id, recommendation),
				false
			)) as string;
			return { id, recommendation };
		} catch (error) {
			this.notify(
				errorMessage(error, 'Rekomendasi belum tersedia. Kamu tetap bisa memilih manual.')
			);
			return null;
		} finally {
			this.pending = '';
		}
	}

	startMatch(
		teamA: string[],
		teamB: string[],
		recommendationId: string | null = null,
		pairingAudit?: { recommended: PairingOption; options: PairingOption[] }
	) {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		return this.runCommand('Memulai match…', async () => {
			const result = await startMatch(
				this.session!.id,
				teamA,
				teamB,
				recommendationId,
				pairingAudit
					? {
							recommendedA: pairingAudit.recommended.teams[0],
							recommendedB: pairingAudit.recommended.teams[1],
							diagnostics: {
								selected_algorithm: 'trueskill-style-bounded-margin-v1',
								recommended_gap: pairingAudit.recommended.predictedGap,
								recommended_strengths: pairingAudit.recommended.teamStrengths,
								pairings: pairingAudit.options.map((option) => ({
									teams: option.teams,
									strengths: option.teamStrengths,
									gap: option.predictedGap,
									teamA_win_probability: option.teamAWinProbability
								}))
							}
						}
					: undefined
			);
			if (pairingAudit && !result.pairingAuditSaved)
				this.notify('Rekomendasi tidak tersimpan. Tim tetap dipilih dan match tetap berjalan.');
			return result;
		});
	}

	completeSet(teamA: number, teamB: number) {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		const set = this.activeMatch?.sets.find((candidate) => candidate.status === 'IN_PROGRESS');
		if (!set) return Promise.resolve(false);
		return this.runCommand(
			'Menyimpan skor…',
			() => completeSet(this.session!.id, this.session!.club_id, set.id, teamA, teamB),
			false
		);
	}

	correctSet(setNumber: 1 | 2, teamA: number, teamB: number) {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		const set = this.activeMatch?.sets.find((candidate) => candidate.setNumber === setNumber);
		if (!set) return Promise.resolve(false);
		return this.runCommand('Memperbaiki skor…', () =>
			correctCompletedSet(this.session!.club_id, set.id, teamA, teamB)
		);
	}

	substitute(
		outgoingPlayerId: string,
		replacementPlayerId: string,
		outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
	) {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		return this.runCommand('Memperbarui susunan Set 2…', () =>
			substitutePlayer(this.session!.id, outgoingPlayerId, replacementPlayerId, outgoingStatus)
		);
	}

	abandon() {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		return this.runCommand('Membatalkan match…', () => abandonMatch(this.session!.id));
	}

	setLeaveAfterMatch(participantId: string, leaveAfterMatch: boolean) {
		if (!this.session || !this.adminAuthorized) return Promise.resolve(false);
		return this.runCommand('Menyimpan status pulang…', () =>
			setLeaveAfterMatch(this.session!.id, participantId, leaveAfterMatch)
		);
	}

	async close() {
		if (!this.session || !this.adminAuthorized || this.pending) return false;
		if (!this.online) {
			this.notify('Koneksi terputus. Sesi belum bisa ditutup.');
			return false;
		}
		this.pending = 'Menutup sesi…';
		try {
			await this.runMutation(() => closeSession(this.session!.id), true);
			return true;
		} catch (error) {
			this.notify(errorMessage(error, 'Sesi tidak dapat ditutup.'));
			return false;
		} finally {
			this.pending = '';
		}
	}
}
