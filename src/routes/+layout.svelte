<script lang="ts">
	import 'sve-ui/theme.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

	let { children } = $props();

	// Query owns server state. Realtime handlers invalidate these queries rather than patching rows locally.
	const queryClient = new QueryClient({
		defaultOptions: { queries: { staleTime: 15_000, retry: 2 } }
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<QueryClientProvider client={queryClient}>{@render children()}</QueryClientProvider>
