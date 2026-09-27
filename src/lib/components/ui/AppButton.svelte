<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		variant = 'primary',
		type = 'button',
		disabled = false,
		onclick
	}: {
		children: Snippet;
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		onclick?: () => void;
	} = $props();

	const styles = {
		primary:
			'bg-lime-300 text-lime-950 shadow-[0_8px_0_#a3c821] hover:bg-lime-200 active:translate-y-1 active:shadow-[0_4px_0_#a3c821]',
		secondary:
			'border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50',
		ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950',
		danger:
			'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
	} as const;
</script>

<button
	{type}
	{disabled}
	{onclick}
	class={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition focus:ring-4 focus:ring-lime-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
>
	{@render children()}
</button>
