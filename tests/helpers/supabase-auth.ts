import type { Page } from '@playwright/test';

type E2EUser = {
	id: string;
	email?: string;
	aud?: string;
	role?: string;
	app_metadata?: Record<string, unknown>;
	user_metadata?: Record<string, unknown>;
	created_at?: string;
};

/** Seed the same cookie format that @supabase/ssr reads during SvelteKit loads. */
export async function seedSupabaseAuthCookie(page: Page, user: E2EUser) {
	const expiresAt = Math.floor(Date.now() / 1000) + 3600;
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
	const payload = Buffer.from(
		JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: expiresAt })
	).toString('base64url');
	const session = {
		access_token: `${header}.${payload}.e2e-signature`,
		refresh_token: 'e2e-refresh-token',
		token_type: 'bearer',
		expires_in: 3600,
		expires_at: expiresAt,
		user: {
			aud: 'authenticated',
			role: 'authenticated',
			app_metadata: {},
			user_metadata: {},
			created_at: new Date().toISOString(),
			...user
		}
	};
	await page.context().addCookies([
		{
			name: 'sb-courtside-e2e-auth-token',
			value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
			domain: 'localhost',
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'Lax',
			expires: expiresAt
		}
	]);
}

/** Seed the PKCE verifier cookie that a real Supabase recovery redirect carries forward. */
export async function seedSupabasePkceVerifierCookie(page: Page, verifier: string) {
	const value = `base64-${Buffer.from(JSON.stringify(verifier)).toString('base64url')}`;
	await page.context().addCookies([
		{
			name: 'sb-courtside-e2e-auth-token-code-verifier',
			value,
			domain: 'localhost',
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'Lax',
			expires: Math.floor(Date.now() / 1000) + 3600
		}
	]);
}
