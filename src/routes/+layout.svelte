<script lang="ts">
	import 'sve-ui/theme.css';
	import './layout.css';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { browserQueryClient, createQueryClient } from '$lib/data/query-client';
	import { Toast } from 'sve-ui';

	let { children } = $props();

	// Query owns server state. Realtime handlers invalidate these queries rather than patching rows locally.
	const queryClient = browser ? browserQueryClient : createQueryClient();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<QueryClientProvider client={queryClient}>
	{#key page.params.clubId ?? 'public'}{@render children()}{/key}
	<Toast.Viewport position="bottom-right" max={5} label="Notifications" />
</QueryClientProvider>
