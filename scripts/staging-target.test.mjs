import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStagingTarget } from './staging-target.mjs';

const stagingProjectRef = 'teststagingproject12';
const productionProjectRef = 'testprodprojectref12';
const stagingUrl = `https://${stagingProjectRef}.supabase.co`;

test('accepts the exact expected hosted staging project', () => {
	assert.equal(
		assertStagingTarget({
			supabaseUrl: stagingUrl,
			expectedProjectRef: stagingProjectRef,
			productionProjectRef
		}),
		stagingUrl
	);
});

test('rejects the production project even when configured as the expected ref', () => {
	assert.throws(
		() =>
			assertStagingTarget({
				supabaseUrl: `https://${productionProjectRef}.supabase.co`,
				expectedProjectRef: productionProjectRef,
				productionProjectRef
			}),
		/production/
	);
});

test('rejects a URL whose project ref differs from the configured staging ref', () => {
	assert.throws(
		() =>
			assertStagingTarget({
				supabaseUrl: `https://anotherprojectref123.supabase.co`,
				expectedProjectRef: stagingProjectRef,
				productionProjectRef
			}),
		/staging URL/
	);
});

test('rejects malformed or non-HTTPS URLs and lookalike hosts', () => {
	for (const supabaseUrl of [
		'not a URL',
		`http://${stagingProjectRef}.supabase.co`,
		`https://${stagingProjectRef}.supabase.co.attacker.example`
	]) {
		assert.throws(() =>
			assertStagingTarget({
				supabaseUrl,
				expectedProjectRef: stagingProjectRef,
				productionProjectRef
			})
		);
	}
});

test('rejects credentials embedded in the URL and missing project refs', () => {
	assert.throws(() =>
		assertStagingTarget({
			supabaseUrl: `https://user:password@${stagingProjectRef}.supabase.co`,
			expectedProjectRef: stagingProjectRef,
			productionProjectRef
		})
	);
	assert.throws(() =>
		assertStagingTarget({ supabaseUrl: stagingUrl, expectedProjectRef: '', productionProjectRef })
	);
});
