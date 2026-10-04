<script lang="ts">
	import { Sheet } from 'sve-ui';
	import type { Snippet } from 'svelte';

	let {
		open,
		title,
		onOpenChange,
		class: className = '',
		children
	}: {
		open: boolean;
		title: string;
		onOpenChange: (open: boolean) => void;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<Sheet.Root {open} {onOpenChange}>
	<Sheet.Content side="bottom" size="lg" class={`court-sheet ${className}`}>
		<Sheet.Title class="sr-only">{title}</Sheet.Title>
		{@render children()}
	</Sheet.Content>
</Sheet.Root>
