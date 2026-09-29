<script lang="ts">
	import { Skeleton } from 'sve-ui';

	let {
		width = '100%',
		height = '1rem',
		class: className = ''
	} = $props<{
		width?: string;
		height?: string;
		class?: string;
	}>();
</script>

<Skeleton
	variant="text"
	{width}
	{height}
	class={className}
	style="--sve-color-default-surface: #e5ece5; --sve-color-default: #fffaf0; --sve-radius-sm: 0"
/>
