<script lang="ts">
	let { label = 'Menyiapkan lapangan…', compact = false }: { label?: string; compact?: boolean } = $props();
</script>

<div class={`relative overflow-hidden border border-[#b9c5bb] bg-[#fffaf0] ${compact ? 'p-4' : 'p-6'}`} aria-live="polite" aria-busy="true">
	<div aria-hidden="true" class="absolute inset-y-0 left-[18%] right-[18%] border-x border-[#b9c5bb]/55"></div>
	<div aria-hidden="true" class="absolute inset-x-[18%] top-1/2 border-t border-[#b9c5bb]/55"></div>
	<div class="relative flex items-center gap-3"><span class="size-3 animate-pulse bg-[#e2653e]"></span><p class="text-sm font-black text-[#38675b]">{label}</p></div>
</div>
