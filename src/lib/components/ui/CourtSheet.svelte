<script lang="ts">
	import { Sheet } from 'sve-ui';
	import type { Snippet } from 'svelte';

	let {
		open,
		title,
		onOpenChange,
		class: className = '',
		fixedLayout = false,
		header,
		footer,
		children
	}: {
		open: boolean;
		title: string;
		onOpenChange: (open: boolean) => void;
		class?: string;
		fixedLayout?: boolean;
		header?: Snippet;
		footer?: Snippet;
		children: Snippet;
	} = $props();
</script>

<Sheet.Root {open} {onOpenChange}>
	<Sheet.Content side="bottom" size="lg" class={`court-sheet ${className}`}>
		<Sheet.Title class="sr-only">{title}</Sheet.Title>
		{#if fixedLayout}<div class="flex h-[calc(75dvh-1rem)] w-full flex-col overflow-hidden">
				{#if header}<header class="shrink-0">{@render header()}</header>{/if}
				<div class="min-h-0 flex-1 overflow-y-auto">{@render children()}</div>
				{#if footer}<footer class="shrink-0">{@render footer()}</footer>{/if}
			</div>{:else}{@render children()}{/if}
	</Sheet.Content>
</Sheet.Root>
