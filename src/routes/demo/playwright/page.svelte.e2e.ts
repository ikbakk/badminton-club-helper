import { expect, test } from '@playwright/test';

test('routes the demo shortcut into the real Live experience', async ({ page }) => {
	await page.goto('/demo/playwright');
	await expect(page).toHaveURL(/\/clubs\/demo\/live$/);
	await expect(page.getByRole('heading', { name: 'Mulai dari daftar hadir.' })).toBeVisible();
});
