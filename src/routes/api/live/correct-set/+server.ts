import { json, type RequestHandler } from '@sveltejs/kit';
import { replayClubRatings, requireClubAdmin } from '$lib/server/algorithm2-rating';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
		if (!token) return json({ message: 'Sign in required.' }, { status: 401 });
		const body = await request.json();
		if (typeof body.clubId !== 'string' || typeof body.setId !== 'string')
			return json({ message: 'Invalid correction request.' }, { status: 400 });
		await requireClubAdmin(token, body.clubId);
		return json(
			await replayClubRatings({
				clubId: body.clubId,
				setId: body.setId,
				scoreA: Number(body.teamAScore),
				scoreB: Number(body.teamBScore)
			})
		);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Could not correct set.' },
			{ status: 409 }
		);
	}
};
