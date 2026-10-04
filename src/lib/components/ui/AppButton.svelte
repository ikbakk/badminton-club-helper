<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		variant = 'primary',
		type = 'button',
		disabled = false,
		onclick,
		class: className = ''
	}: {
		children: Snippet;
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		onclick?: () => void;
		class?: string;
	} = $props();

	const styles = {
		primary:
			'bg-[#e2653e] text-[#fffaf0] shadow-[0_3px_0_#9a3d25] hover:bg-[#c95031] active:translate-y-px active:shadow-[0_1px_0_#9a3d25]',
		secondary:
			'border border-[#b9c5bb] bg-[#fffaf0] text-[#163630] hover:border-[#38675b] hover:bg-[#f4f1e8]',
		ghost: 'bg-transparent text-[#38675b] hover:bg-[#e4ebe2] hover:text-[#163630]',
		danger:
			'border border-[#e7b8aa] bg-[#fff1ec] text-[#9a3d25] hover:border-[#d57c64] hover:bg-[#ffe2d8]'
	} as const;
</script>

<button
	{type}
	{disabled}
	{onclick}
	class={`inline-flex min-h-11 items-center justify-center gap-2 px-4 py-3 text-sm font-extrabold transition focus:ring-4 focus:ring-[#f2c6b9] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
>
	{@render children()}
</button>
