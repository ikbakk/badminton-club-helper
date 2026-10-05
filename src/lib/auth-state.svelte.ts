import type { Club } from '$lib/data/dashboard';

const storageKey = 'pb-newbie:club-access';
export const authState = $state<{ club: Club | null }>({ club: null });

export function loadCachedClub() {
	try {
		const value = localStorage.getItem(storageKey);
		authState.club = value ? (JSON.parse(value) as Club) : null;
	} catch {
		authState.club = null;
	}
}

export function setCachedClub(club: Club | null) {
	authState.club = club;
	try {
		if (club) localStorage.setItem(storageKey, JSON.stringify(club));
		else localStorage.removeItem(storageKey);
	} catch {
		// The in-memory state still works when browser storage is unavailable.
	}
}
