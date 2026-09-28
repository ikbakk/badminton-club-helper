import { expect, test } from '@playwright/test';

test('public visitor can open the read-only live courtside view', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('PB NEWBIE', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Admin' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'No session is live right now.' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
});
