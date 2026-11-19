import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { supabase } from '$lib/supabase';
import type { User } from '@supabase/supabase-js';

const PUBLIC_SUPABASE_URL = env.PUBLIC_SUPABASE_URL;

function legacySessionStorageKey() {
	if (!PUBLIC_SUPABASE_URL) return null;
	const projectRef = new URL(PUBLIC_SUPABASE_URL).hostname.split('.')[0];
	return `sb-${projectRef}-auth-token`;
}

/** Detect sessions stored by the pre-SSR browser client for one-time cookie migration. */
export function hasLegacyBrowserSession() {
	const key = legacySessionStorageKey();
	return Boolean(browser && key && localStorage.getItem(key));
}

/** Move an existing local-storage session into the cookie-backed SSR client. */
export async function migrateLegacyBrowserSession() {
	const key = legacySessionStorageKey();
	if (!browser || !supabase || !key) return false;

	const { data: current } = await supabase.auth.getSession();
	if (current.session) return false;

	const stored = localStorage.getItem(key);
	if (!stored) return false;

	let legacy: { access_token?: unknown; refresh_token?: unknown };
	try {
		legacy = JSON.parse(stored);
	} catch {
		return false;
	}
	if (typeof legacy.access_token !== 'string' || typeof legacy.refresh_token !== 'string')
		return false;

	const { error } = await supabase.auth.setSession({
		access_token: legacy.access_token,
		refresh_token: legacy.refresh_token
	});
	if (error) throw error;
	localStorage.removeItem(key);
	return true;
}

export async function signInWithPassword(email: string, password: string) {
	if (!supabase) throw new Error('Supabase is not configured.');
	const { error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) throw error;
}
export async function currentUser(): Promise<User | null> {
	if (!supabase) return null;
	const {
		data: { user }
	} = await supabase.auth.getUser();
	return user;
}
