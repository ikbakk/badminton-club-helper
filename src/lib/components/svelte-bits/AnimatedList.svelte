<script lang="ts">
	import { onMount, untrack } from 'svelte';

	type Props = {
		items?: string[];
		onItemSelect?: (item: string, index: number) => void;
		selectedIndices?: number[];
		showGradients?: boolean;
		enableArrowNavigation?: boolean;
		class?: string;
		itemClass?: string;
		displayScrollbar?: boolean;
	};

	let {
		items = [],
		onItemSelect,
		selectedIndices = [],
		showGradients = false,
		enableArrowNavigation = true,
		class: className = '',
		itemClass = '',
		displayScrollbar = true
	}: Props = $props();

	let listRef: HTMLDivElement;
	let selectedIndex = $state(-1);
	let keyboardNav = $state(false);
	let inView = $state<boolean[]>([]);

	$effect(() => {
		if (inView.length !== items.length) untrack(() => (inView = items.map(() => false)));
	});

	function inViewAction(node: HTMLElement, index: number) {
		const io = new IntersectionObserver(
			(entries) => entries.forEach((entry) => (inView[index] = entry.intersectionRatio >= 0.5)),
			{ root: listRef, threshold: [0, 0.5, 1] }
		);
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}

	function choose(index: number) {
		selectedIndex = index;
		onItemSelect?.(items[index], index);
	}

	onMount(() => {
		if (!enableArrowNavigation) return;
		const handler = (event: KeyboardEvent) => {
			if (!listRef?.contains(document.activeElement)) return;
			if (event.key === 'ArrowDown') { event.preventDefault(); keyboardNav = true; selectedIndex = Math.min(selectedIndex + 1, items.length - 1); }
			else if (event.key === 'ArrowUp') { event.preventDefault(); keyboardNav = true; selectedIndex = Math.max(selectedIndex - 1, 0); }
			else if (event.key === 'Enter' && selectedIndex >= 0) { event.preventDefault(); choose(selectedIndex); }
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	});

	$effect(() => {
		if (!keyboardNav || selectedIndex < 0 || !listRef) return;
		listRef.querySelector(`[data-index="${selectedIndex}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		untrack(() => (keyboardNav = false));
	});
</script>

<div class={`relative w-full ${className}`}>
	<div bind:this={listRef} class={`max-h-[min(52dvh,26rem)] overflow-y-auto ${displayScrollbar ? 'court-scrollbar' : ''}`}>
		{#each items as item, index (item)}
			<button use:inViewAction={index} data-index={index} class={`mb-2 flex min-h-12 w-full items-center justify-between border px-4 text-left text-sm font-bold transition ${selectedIndices.includes(index) ? 'border-[#163630] bg-[#163630] text-[#fffaf0]' : 'border-[#b9c5bb] bg-[#fffaf0] text-[#163630] hover:bg-[#e5ece5]'} ${itemClass}`} style:opacity={inView[index] ? 1 : 0.4} style:transform={inView[index] ? 'translateY(0)' : 'translateY(5px)'} onclick={() => choose(index)} aria-pressed={selectedIndices.includes(index)}>
				<span>{selectedIndices.includes(index) ? '✓ ' : ''}{item}</span><span class="text-xs opacity-70">Pilih</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.court-scrollbar { scrollbar-width: thin; scrollbar-color: #38675b #ece7db; }
	.court-scrollbar::-webkit-scrollbar { width: 6px; }
	.court-scrollbar::-webkit-scrollbar-track { background: #ece7db; }
	.court-scrollbar::-webkit-scrollbar-thumb { background: #38675b; }
	@media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
