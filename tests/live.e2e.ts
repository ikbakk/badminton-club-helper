import { expect, test } from '@playwright/test';

test('public visitor can open the read-only live view', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('PB NEWBIE', { exact: true })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Riwayat' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Dana' })).toBeVisible();
});
