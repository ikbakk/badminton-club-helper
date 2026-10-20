import { defineConfig } from '@playwright/test';

export default defineConfig({
	// CI may supply an existing Chromium executable when browser downloads are unavailable.
	use: { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } },
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		timeout: 180_000,
		env: {
			PUBLIC_SUPABASE_URL: 'https://courtside-e2e.supabase.co',
			PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
			SUPABASE_SERVICE_ROLE_KEY: ''
		}
	},
	testMatch: '**/*.e2e.{ts,js}'
});
