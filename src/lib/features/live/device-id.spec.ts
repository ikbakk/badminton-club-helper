import { describe, expect, it, vi } from 'vitest';
import { createDeviceId } from './device-id';

describe('createDeviceId', () => {
	it('uses randomUUID when the browser supports it', () => {
		const randomUUID = vi.fn(() => 'device-uuid');
		const getRandomValues = vi.fn();

		expect(createDeviceId({ randomUUID, getRandomValues })).toBe('device-uuid');
		expect(getRandomValues).not.toHaveBeenCalled();
	});

	it('creates a UUID-shaped ID when randomUUID is unavailable', () => {
		const getRandomValues = (bytes: Uint8Array) => {
			bytes.fill(0);
			return bytes;
		};

		expect(createDeviceId({ getRandomValues })).toBe('00000000-0000-4000-8000-000000000000');
	});
});
