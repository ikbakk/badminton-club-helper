import { page } from '$app/state';
import { resolve } from '$app/paths';

export function selectedClubId(): string {
	return page.params.clubId ?? '';
}

/** Club navigation always carries an explicit identity, never a default club. */
export function clubHref(path: string): string {
	const clubId = selectedClubId();
	return clubId ? resolve('/clubs/[clubId]', { clubId }) + path : resolve('/start');
}
