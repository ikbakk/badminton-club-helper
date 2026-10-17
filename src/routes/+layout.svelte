<script lang="ts">
	import 'sve-ui/theme.css';
	import './layout.css';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { Toast } from 'sve-ui';

	let { children } = $props();

	// Query owns server state. Realtime handlers invalidate these queries rather than patching rows locally.
	const queryClient = new QueryClient({
		defaultOptions: { queries: { staleTime: 15_000, retry: 2 } }
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<QueryClientProvider client={queryClient}>
	{#key page.params.clubId ?? 'public'}{@render children()}{/key}
	<Toast.Viewport position="bottom-right" max={5} label="Notifications" />
</QueryClientProvider>
