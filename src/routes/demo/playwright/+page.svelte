<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	onMount(() => {
		void goto(resolve('/?demo=1'), { replaceState: true });
	});
</script>
