import { browser } from '$app/environment';
import { createBrowserClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
const PUBLIC_SUPABASE_URL = env.PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = env.PUBLIC_SUPABASE_ANON_KEY;

/** Undefined during local UI work; commands must fail clearly instead of faking persistence. */
export const supabase =
	browser && PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY
		? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)
		: null;
export const supabaseConfigured = Boolean(supabase);
