import { supabase } from '$lib/supabase';

export type ClubSettings = {
	club_id: string;
	name: string;
	bank_name: string | null;
	bank_account_name: string | null;
	bank_account_number: string | null;
	shopeepay_name: string | null;
	shopeepay_number: string | null;
	qris_image_url: string | null;
	publish_publicly: boolean;
};

export type ClubSettingsInput = Omit<ClubSettings, 'club_id'>;
export type PublicPaymentDestinations = Omit<ClubSettingsInput, 'name' | 'publish_publicly'>;
export const publicPaymentDestinationsQueryKey = (clubId: string) =>
	['public-payment-destinations', clubId] as const;

function client() {
	if (!supabase) throw new Error('Supabase is not configured.');
	return supabase;
}

export async function getClubSettings(clubId: string): Promise<ClubSettings | null> {
	const { data, error } = await client().rpc('club_settings', { p_club_id: clubId });
	if (error) throw error;
	return (data?.[0] ?? null) as ClubSettings | null;
}

export async function updateClubSettings(clubId: string, settings: ClubSettingsInput) {
	const { error } = await client().rpc('update_club_settings', {
		p_club_id: clubId,
		p_name: settings.name,
		p_bank_name: settings.bank_name,
		p_bank_account_name: settings.bank_account_name,
		p_bank_account_number: settings.bank_account_number,
		p_shopeepay_name: settings.shopeepay_name,
		p_shopeepay_number: settings.shopeepay_number,
		p_qris_image_url: settings.qris_image_url,
		p_publish_publicly: settings.publish_publicly
	});
	if (error) throw error;
}

export async function getPublicPaymentDestinations(
	clubId: string
): Promise<PublicPaymentDestinations | null> {
	const { data, error } = await client().rpc('public_payment_destinations', {
		p_club_id: clubId
	});
	if (error) throw error;
	return (data?.[0] ?? null) as PublicPaymentDestinations | null;
}
