const projectRefPattern = /^[a-z0-9]{20}$/;

/**
 * Validate the only remote Supabase target permitted for test writes.
 * Local Supabase URLs are deliberately excluded; this guard protects staging scripts.
 */
export function assertStagingTarget({ supabaseUrl, expectedProjectRef, productionProjectRef }) {
	if (!expectedProjectRef || !projectRefPattern.test(expectedProjectRef)) {
		throw new Error('A valid staging project ref is required.');
	}
	if (!productionProjectRef || !projectRefPattern.test(productionProjectRef)) {
		throw new Error('A valid production project ref is required.');
	}
	if (expectedProjectRef === productionProjectRef) {
		throw new Error('The configured staging project ref is the production project.');
	}

	let url;
	try {
		url = new URL(supabaseUrl);
	} catch {
		throw new Error('The staging Supabase URL must be a valid HTTPS URL.');
	}

	const expectedHost = `${expectedProjectRef}.supabase.co`;
	if (
		url.protocol !== 'https:' ||
		url.hostname !== expectedHost ||
		url.port !== '' ||
		url.username !== '' ||
		url.password !== '' ||
		url.pathname !== '/' ||
		url.search !== '' ||
		url.hash !== ''
	) {
		throw new Error(
			'The staging URL must exactly match https://<staging-project-ref>.supabase.co.'
		);
	}
	if (
		expectedProjectRef === productionProjectRef ||
		url.hostname === `${productionProjectRef}.supabase.co`
	) {
		throw new Error('Refusing to run tests against the production project.');
	}
	return url.origin;
}
