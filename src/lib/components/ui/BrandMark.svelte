<script lang="ts">
	let { size = 26 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true"
	><path d="M3 23 14 5h5L8 23H3Zm8 0L22 5h4L15 23h-4Z" fill="currentColor" /></svg
>

<style>
	svg {
		color: var(--court-action);
		flex-shrink: 0;
	}
</style>
