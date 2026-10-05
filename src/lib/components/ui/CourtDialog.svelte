<script lang="ts">
	import { Dialog } from 'sve-ui';
	import type { Snippet } from 'svelte';

	let {
		open,
		title,
		onOpenChange,
		panelClass = '',
		onOpenAutoFocus,
		children
	}: {
		open: boolean;
		title: string;
		onOpenChange: (open: boolean) => void;
		panelClass?: string;
		onOpenAutoFocus?: (event: Event) => void;
		children: Snippet;
	} = $props();
</script>

<Dialog.Root {open} {onOpenChange}>
	<Dialog.Content class={`court-dialog ${panelClass}`} {onOpenAutoFocus}>
		<Dialog.Title class="sr-only">{title}</Dialog.Title>
		{@render children()}
	</Dialog.Content>
</Dialog.Root>
