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
		primary: 'court-button--primary',
		secondary: 'court-button--secondary',
		ghost: 'court-button--ghost',
		danger: 'court-button--danger'
	} as const;
</script>

<button {type} {disabled} {onclick} class={`court-button ${styles[variant]} ${className}`}>
	{@render children()}
</button>
