import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';

export function load({ params }: { params: { clubId: string; id: string } }) {
	throw redirect(
		307,
		resolve('/clubs/[clubId]/session-close/[id]?step=confirm', {
			clubId: params.clubId,
			id: params.id
		})
	);
}
