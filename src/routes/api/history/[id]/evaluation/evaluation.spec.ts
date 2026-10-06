import { beforeEach, describe, expect, it, vi } from 'vitest';

const { evaluatePersistedSession } = vi.hoisted(() => ({ evaluatePersistedSession: vi.fn() }));
vi.mock('$lib/server/session-evaluation', () => ({ evaluatePersistedSession }));
import { GET } from './+server';

describe('admin session evaluation export route', () => {
	beforeEach(() => evaluatePersistedSession.mockReset());
	it('requires an Authorization token before exposing the diagnostics', async () => {
		const response = await GET({
			params: { id: 'session-x' },
			request: new Request('http://local')
		} as never);
		expect(response.status).toBe(401);
		expect(evaluatePersistedSession).not.toHaveBeenCalled();
	});
	it('returns the structured session evaluation as private, non-cacheable JSON', async () => {
		const evaluation = {
			sessionId: 'session-x',
			algorithm1: { recommendations: 4, overrides: 1 },
			algorithm2: { recommendations: 2, overrides: 1 },
			flags: ['PAIRING_OVERRIDE_HIGH']
		};
		evaluatePersistedSession.mockResolvedValue(evaluation);
		const response = await GET({
			params: { id: 'session-x' },
			request: new Request('http://local', { headers: { Authorization: 'Bearer admin-token' } })
		} as never);
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toContain('private');
		expect(await response.json()).toEqual(evaluation);
		expect(evaluatePersistedSession).toHaveBeenCalledWith('session-x', 'admin-token');
	});
});
