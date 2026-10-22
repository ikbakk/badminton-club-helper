import { expect, it } from 'vitest';
import { render } from 'svelte/server';
import type { ComponentProps } from 'svelte';
import MatchCourt from './MatchCourt.svelte';
import type { Participant } from '$lib/domain/types';

const commands = {
	onpreparenext: async () => null,
	onstart: async () => false,
	oncomplete: async () => false,
	oncorrect: async () => false,
	onabandon: () => undefined,
	onsubstitute: async () => false,
	onstartdecider: async () => false,
	onskiptiedmatch: async () => false
};
function court(canManage: boolean, statuses: Participant['status'][] = []) {
	const participants: Participant[] = statuses.map((status, i) => ({
		id: `p${i}`,
		name: `Pemain ${i}`,
		membership: 'MEMBER',
		rating: 1200,
		uncertainty: 280,
		status,
		consecutiveMatches: 0,
		opportunities: 0,
		missedOpportunities: 0,
		currentOpportunityDebt: 0,
		rotationsPlayed: 0,
		setsPlayed: 0
	}));
	const props: ComponentProps<typeof MatchCourt> = {
		...commands,
		participants,
		activeMatch: null,
		courtNumber: 2,
		canManage
	};
	return render(MatchCourt, { props }).body.replace(/<!--.*?-->/g, '');
}
it('shows an empty court before anybody checks in, for admins and public viewers', () => {
	for (const admin of [true, false]) expect(court(admin)).toContain('Menunggu pemain');
});
it('explains the missing READY player even while four other players are playing', () => {
	const html = court(true, ['PLAYING', 'PLAYING', 'PLAYING', 'PLAYING', 'READY', 'READY', 'READY']);
	expect(html).toContain('butuh 1 pemain lagi');
	expect(html).toContain('disabled');
});
it('keeps a ready empty court visible to the public without operator actions', () => {
	const html = court(false, ['READY', 'READY', 'READY', 'READY']);
	expect(html).toContain('4 pemain siap');
	expect(html).not.toContain('Siapkan match</');
});
