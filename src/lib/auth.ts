import { supabase } from '$lib/supabase';
import type { User } from '@supabase/supabase-js';

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
