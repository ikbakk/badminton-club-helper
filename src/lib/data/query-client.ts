import { QueryClient } from '@tanstack/svelte-query';

export function createQueryClient() {
	return new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 2 } } });
}
// Shared only in the browser. The root layout creates a separate client for SSR.
export const browserQueryClient = createQueryClient();
export const publicSurfaceKey = (clubId: string, surface: string, id = '') =>
	['public-surface', clubId, surface, id] as const;
