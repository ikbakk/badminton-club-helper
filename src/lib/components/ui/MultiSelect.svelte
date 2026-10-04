<script lang="ts">
	import { Check } from '@lucide/svelte';

	type Option = { value: string; label: string; description?: string; disabled?: boolean };

	let {
		options,
		selected,
		onSelectionChange,
		label,
		maxSelected,
		emptyMessage = 'Belum ada yang bisa dipilih.'
	}: {
		options: Option[];
		selected: string[];
		onSelectionChange: (selected: string[]) => void;
		label: string;
		maxSelected?: number;
		emptyMessage?: string;
	} = $props();

	function toggle(value: string) {
		if (selected.includes(value)) {
			onSelectionChange(selected.filter((item) => item !== value));
		} else if (maxSelected === undefined || selected.length < maxSelected) {
			onSelectionChange([...selected, value]);
		}
	}
</script>

<fieldset class="min-w-0" aria-label={label}>
	<legend class="sr-only">{label}</legend>
	{#if options.length}
		<ul class="divide-y divide-[#d6ddd5]">
			{#each options as option (option.value)}
				<li>
					<label
						class="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-[#edf3ec] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
					>
						<span class="relative grid size-6 shrink-0 place-items-center">
							<input
								class="peer absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-none border-2 border-[#9aada3] bg-transparent checked:border-[#163630] checked:bg-[#163630] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2653e]"
								type="checkbox"
								checked={selected.includes(option.value)}
								disabled={option.disabled ||
									(!selected.includes(option.value) &&
										maxSelected !== undefined &&
										selected.length >= maxSelected)}
								onchange={() => toggle(option.value)}
							/>
							<Check
								aria-hidden="true"
								class="pointer-events-none relative z-20 text-transparent peer-checked:text-[#fffaf0]"
								size={15}
								strokeWidth={3}
							/>
						</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-bold text-[#163630]">{option.label}</span>
							{#if option.description}<span class="mt-0.5 block text-xs text-[#527169]"
									>{option.description}</span
								>{/if}
						</span>
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="px-4 py-7 text-center text-sm text-[#527169]">{emptyMessage}</p>
	{/if}
</fieldset>
