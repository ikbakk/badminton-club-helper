<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	if (browser) void goto(resolve('/live'), { replaceState: true });
</script>

<div class="grid min-h-dvh place-items-center bg-[#f4f1e8] text-sm font-bold text-[#38675b]">
	Membuka Live…
</div>
