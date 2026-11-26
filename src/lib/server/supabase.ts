import { createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

const requestClients = new WeakMap<object, SupabaseClient>();

export function createRequestSupabase(event: Pick<RequestEvent, 'cookies' | 'setHeaders'>) {
	const cached = requestClients.get(event);
	if (cached) return cached;
	const url = env.PUBLIC_SUPABASE_URL;
	const key = env.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !key) return null;
	const client = createServerClient(url, key, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});
	requestClients.set(event, client);
	return client;
}
