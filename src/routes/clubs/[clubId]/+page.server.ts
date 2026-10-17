import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
export function load({ params }: { params: { clubId: string } }) {
	redirect(307, resolve('/clubs/[clubId]/live', params));
}
