import { json, type RequestHandler } from '@sveltejs/kit';
import { evaluatePersistedSession } from '$lib/server/session-evaluation';

export const GET: RequestHandler = async ({ params, request }) => {
	const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
	if (!token) return json({ message: 'Sign in required.' }, { status: 401 });
	if (!params.id) return json({ message: 'Session not found.' }, { status: 404 });
	try {
		return json(await evaluatePersistedSession(params.id, token), {
			headers: { 'Cache-Control': 'private, no-store' }
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Could not evaluate this session.';
		const status = /admin|sign in/i.test(message) ? 403 : /not found/i.test(message) ? 404 : 500;
		return json({ message }, { status, headers: { 'Cache-Control': 'private, no-store' } });
	}
};
