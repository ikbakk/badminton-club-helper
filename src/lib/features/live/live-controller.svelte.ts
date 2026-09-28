import { browser } from '$app/environment';
import {
	abandonMatch,
	addGuestAndCheckIn,
	changeParticipantStatus,
	checkInPlayer,
	claimOperatorLease,
	completeSet,
	closeSession,
	confirmSessionFee,
	loadLiveSession,
	startMatch,
	setLeaveAfterMatch,
	substitutePlayer,
	type ActiveMatch,
	type LiveSession
} from '$lib/data/live';
import type { Participant, ParticipantStatus } from '$lib/domain/types';

type Notice = (message: string) => void;

export class LiveController {
	session = $state<LiveSession | null>(null);
	participants = $state.raw<Participant[]>([]);
	activeMatch = $state<ActiveMatch | null>(null);
	operatorLease = $state<string | null>(null);
	pending = $state('');
	closedSummary = $state<{ attendance: number; sets: number; startedAt: string } | null>(null);

	constructor(private readonly notify: Notice) {}

	get isOperator() {
		return Boolean(this.operatorLease);
	}

	private leaseKey(sessionId: string) {
		return `pb-newbie:operator-lease:${sessionId}`;
	}

	private deviceKey() {
		return 'pb-newbie:operator-device';
	}

	private getDeviceId() {
		if (!browser) return '';
		let id = localStorage.getItem(this.deviceKey());
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem(this.deviceKey(), id);
		}
		return id;
	}

	private clearLease() {
		if (browser && this.session) localStorage.removeItem(this.leaseKey(this.session.id));
		this.operatorLease = null;
	}

	private isLeaseLost(error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return /valid operator lease required|(?:invalid|revoked) (?:operator )?lease/i.test(message);
	}

	async refresh() {
		try {
			const live = await loadLiveSession();
			this.session = live.session;
			this.participants = live.participants;
			this.activeMatch = live.activeMatch;
			this.operatorLease =
				this.session && browser ? localStorage.getItem(this.leaseKey(this.session.id)) : null;
		} catch (error) {
			this.notify(error instanceof Error ? error.message : 'Could not load the live session.');
		}
	}

	private async runCommand(label: string, action: () => Promise<unknown>) {
		this.pending = label;
		try {
			await action();
			await this.refresh();
			return true;
		} catch (error) {
			if (this.isLeaseLost(error)) {
				this.clearLease();
				await this.refresh();
				this.notify('Session control moved to another device.');
			} else {
				this.notify(error instanceof Error ? error.message : 'Could not update the live session.');
			}
			return false;
		} finally {
			this.pending = '';
		}
	}

	async claim(pin: string, takeover = false) {
		if (!this.session || !pin) return { ok: false, requiresTakeover: false };
		this.pending = takeover ? 'Taking over…' : 'Checking PIN…';
		try {
			const lease = await claimOperatorLease(this.session.id, pin, this.getDeviceId(), takeover);
			localStorage.setItem(this.leaseKey(this.session.id), lease);
			this.operatorLease = lease;
			this.notify('You’re operating this session.');
			return { ok: true, requiresTakeover: false };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Could not claim session control.';
			if (/another device/i.test(message) && !takeover)
				return { ok: false, requiresTakeover: true };
			this.notify(
				/invalid session pin/i.test(message) ? "That PIN isn't correct. Try again." : message
			);
			return { ok: false, requiresTakeover: false };
		} finally {
			this.pending = '';
		}
	}

	checkIn(playerId: string) {
		if (!this.session || !this.operatorLease) return Promise.resolve(false);
		return this.runCommand('Checking in player…', () =>
			checkInPlayer(this.session!.id, this.operatorLease!, playerId)
		);
	}

	addGuest(name: string) {
		if (!this.session || !this.operatorLease) return Promise.resolve(false);
		return this.runCommand('Adding guest…', () =>
			addGuestAndCheckIn(this.session!.id, this.operatorLease!, name)
		);
	}

	setStatus(participantId: string, status: ParticipantStatus) {
		if (!this.session || !this.operatorLease) return Promise.resolve(false);
		return this.runCommand('Updating player…', () =>
			changeParticipantStatus(this.session!.id, this.operatorLease!, participantId, status)
		);
	}

	startMatch(teamA: string[], teamB: string[]) {
		if (!this.session || !this.operatorLease) return Promise.resolve(false);
		return this.runCommand('Starting match…', () =>
			startMatch(this.session!.id, this.operatorLease!, teamA, teamB)
		);
	}

	completeSet(teamA: number, teamB: number) {
		if (!this.session || !this.operatorLease) return Promise.resolve(false);
		return this.runCommand('Saving score…', () =>
			completeSet(this.session!.id, this.operatorLease!, teamA, teamB)
		);
	}

	substitute(
		outgoingPlayerId: string,
		replacementPlayerId: string,
		outgoingStatus: 'RESTING' | 'OUT' | 'LEFT'
	) {
		if (!this.session || !this.operatorLease) return Promise.resolve(false);
		return this.runCommand('Updating Set 2 lineup…', () =>
			substitutePlayer(
				this.session!.id,
				this.operatorLease!,
				outgoingPlayerId,
				replacementPlayerId,
				outgoingStatus
			)
		);
	}

	abandon() {
		if (!this.session || !this.operatorLease) return Promise.resolve(false);
		return this.runCommand('Abandoning match…', () =>
			abandonMatch(this.session!.id, this.operatorLease!)
		);
	}

	setLeaveAfterMatch(participantId: string, leaveAfterMatch: boolean) {
		if (!this.session || !this.operatorLease) return Promise.resolve(false);
		return this.runCommand('Menyimpan status pulang…', () =>
			setLeaveAfterMatch(this.session!.id, this.operatorLease!, participantId, leaveAfterMatch)
		);
	}

	async close() {
		if (!this.session || !this.operatorLease) return false;
		this.pending = 'Menutup sesi…';
		try {
			this.closedSummary = await closeSession(this.session.id, this.operatorLease);
			return true;
		} catch (error) {
			this.notify(error instanceof Error ? error.message : 'Sesi tidak dapat ditutup.');
			return false;
		} finally {
			this.pending = '';
		}
	}

	async confirmFee(fee: number) {
		if (!this.session || !this.operatorLease) return false;
		this.pending = 'Menyimpan biaya…';
		try {
			await confirmSessionFee(this.session.id, this.operatorLease, fee);
			return true;
		} catch (error) {
			this.notify(error instanceof Error ? error.message : 'Biaya tidak dapat disimpan.');
			return false;
		} finally {
			this.pending = '';
		}
	}
}
