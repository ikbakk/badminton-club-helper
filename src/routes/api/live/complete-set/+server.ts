import { json, type RequestHandler } from '@sveltejs/kit';
import { commitCompletedSet, requireClubAdmin } from '$lib/server/algorithm2-rating';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
		if (!token) return json({ message: 'Sign in required.' }, { status: 401 });
		const body = await request.json();
		if (
			typeof body.sessionId !== 'string' ||
			typeof body.clubId !== 'string' ||
			typeof body.setId !== 'string'
		)
			return json({ message: 'Invalid completion request.' }, { status: 400 });
		await requireClubAdmin(token, body.clubId);
		const result = await commitCompletedSet({
			sessionId: body.sessionId,
			clubId: body.clubId,
			setId: body.setId,
			scoreA: Number(body.teamAScore),
			scoreB: Number(body.teamBScore)
		});
		return json({ result });
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Could not complete set.' },
			{ status: 409 }
		);
	}
};
