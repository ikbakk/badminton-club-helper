<script lang="ts">
	let { name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' } = $props();
	let initials = $derived(
		name
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((word) => word[0])
			.join('')
			.toUpperCase() || '?'
	);
</script>

<span class="avatar {size}" aria-hidden="true">{initials}</span>

<style>
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--court-soft);
		color: var(--court-ink);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: -0.02em;
	}
	.sm {
		width: 32px;
		height: 32px;
		font-size: 10px;
	}
	.lg {
		width: 80px;
		height: 80px;
		font-size: 26px;
	}
</style>
