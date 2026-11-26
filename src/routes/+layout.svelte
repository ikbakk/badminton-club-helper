<script lang="ts">
	import 'sve-ui/theme.css';
	import './layout.css';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import { QueryClientProvider } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { browserQueryClient, createQueryClient } from '$lib/data/query-client';
	import { Toast } from 'sve-ui';
	import { beforeNavigate, onNavigate, afterNavigate } from '$app/navigation';
	import { prefetchNavigation } from '$lib/data/navigation-queries';
	import { gsap } from 'gsap';
	import { onDestroy, tick } from 'svelte';
	import shuttle from '$lib/assets/motion/shuttlecock.svg';

	let { children } = $props();
	const queryClient = browser ? browserQueryClient : createQueryClient();
	let motion = $state<HTMLDivElement>();
	let timeline: gsap.core.Timeline | undefined;
	let generation = 0;
	let active = false;
	let reverse = false;
	let reduced = false;
	let sweepProgress = 0;
	let outgoing: Element | null = null;

	function drawSweep(progress: number, backwards: boolean) {
		const shape = motion?.querySelector<SVGPathElement>('.navigation-sweep');
		const edge = motion?.querySelector<SVGPathElement>('.navigation-sweep-edge');
		const top = backwards ? 122 - 145 * progress : -22 + 145 * progress;
		const bottom = top + (backwards ? 30 : -30);
		const path = backwards
			? `M 100 0 L ${top} 0 C ${top - 12} 28 ${bottom + 14} 66 ${bottom} 100 L 100 100 Z`
			: `M 0 0 L ${top} 0 C ${top - 12} 28 ${bottom + 14} 66 ${bottom} 100 L 0 100 Z`;
		shape?.setAttribute('d', path);
		edge?.setAttribute('d', `M ${top} 0 C ${top - 12} 28 ${bottom + 14} 66 ${bottom} 100`);
		sweepProgress = progress;
	}

	beforeNavigate(({ from, to, willUnload, type }) => {
		if (willUnload || !from || !to || from.url.pathname === to.url.pathname) return;
		generation++;
		active = true;
		reverse = type === 'popstate';
		reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		void prefetchNavigation(to.url).catch(() => {});
		timeline?.kill();
		if (outgoing) gsap.set(outgoing, { clearProps: 'transform' });
		if (motion) gsap.set(motion, { clearProps: 'all' });
		if (reduced) return;
		outgoing = document.querySelector('main');
		const direction = reverse ? -1 : 1;
		sweepProgress = 0;
		timeline = gsap.timeline();
		if (outgoing)
			timeline.to(
				outgoing,
				{
					x: -direction * 10,
					y: -4,
					scale: 0.99,
					rotation: -direction * 0.35,
					duration: 0.25,
					ease: 'power2.inOut'
				},
				0
			);
		if (motion) {
			const flight = motion.querySelector<HTMLImageElement>('.shuttle-flight');
			const trail = motion.querySelector('.shuttle-trail');
			gsap.set(motion, { opacity: 1 });
			const sweep = { progress: 0 };
			drawSweep(0, reverse);
			timeline.to(
				sweep,
				{
					progress: 1,
					duration: 0.46,
					ease: 'power4.inOut',
					onUpdate: () => drawSweep(sweep.progress, reverse)
				},
				0
			);
			const arc = { progress: 0 };
			gsap.set(flight, { opacity: 0 });
			gsap.set(trail, { opacity: 0 });
			timeline.to(
				arc,
				{
					progress: 1,
					duration: 0.48,
					ease: 'power3.inOut',
					onUpdate: () => {
						const t = arc.progress;
						const startX = direction > 0 ? 13 : 87;
						const endX = direction > 0 ? 87 : 13;
						const x = startX + (endX - startX) * t;
						const y = 78 - 50 * Math.sin(Math.PI * t * 0.78) - 9 * t;
						const tailT = Math.max(0, t - 0.2);
						const tailX = startX + (endX - startX) * tailT;
						const tailY = 78 - 50 * Math.sin(Math.PI * tailT * 0.78) - 9 * tailT;
						const middleT = (tailT + t) / 2;
						const middleX = startX + (endX - startX) * middleT;
						const middleY = 78 - 50 * Math.sin(Math.PI * middleT * 0.78) - 9 * middleT;
						if (flight) {
							flight.style.left = `${x}%`;
							flight.style.top = `${y}%`;
							flight.style.transform = `translate(-50%, -50%) rotate(${direction > 0 ? 42 : 222}deg)`;
							flight.style.opacity = String(Math.min(1, t * 5, (1 - t) * 5));
						}
						trail?.setAttribute('d', `M ${tailX} ${tailY} Q ${middleX} ${middleY - 2} ${x} ${y}`);
						gsap.set(trail, { opacity: Math.min(0.58, t * 3, (1 - t) * 3) });
					}
				},
				0
			);
		}
	});
	onNavigate(() => {});
	afterNavigate(() => {
		if (!active) return;
		const current = generation;
		active = false;
		void (async () => {
			await tick();
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const deadline = Date.now() + 480;
			while (
				current === generation &&
				Date.now() < deadline &&
				queryClient
					.getQueryCache()
					.getAll()
					.some(
						(query) =>
							query.meta?.navigationCritical === true &&
							query.isActive() &&
							query.state.fetchStatus === 'fetching' &&
							query.state.data === undefined
					)
			)
				await new Promise((resolve) => setTimeout(resolve, 40));
			if (current !== generation) return;
			timeline?.kill();
			if (outgoing) gsap.set(outgoing, { clearProps: 'transform' });
			if (reduced || !motion) return;
			const motionElement = motion;
			const sweep = { progress: sweepProgress };
			const flight = motionElement.querySelector('.shuttle-flight');
			const trail = motionElement.querySelector('.shuttle-trail');
			timeline = gsap
				.timeline({ onComplete: () => gsap.set(motionElement, { opacity: 0 }) })
				.to([flight, trail], { opacity: 0, duration: 0.16, ease: 'power1.out' }, 0)
				.to(sweep, {
					progress: 1,
					duration: 0.13,
					ease: 'power3.in',
					onUpdate: () => drawSweep(sweep.progress, reverse)
				})
				.to(sweep, {
					progress: 0,
					duration: 0.44,
					ease: 'power4.out',
					onUpdate: () => drawSweep(sweep.progress, reverse)
				});
		})();
	});
	onDestroy(() => {
		generation++;
		timeline?.kill();
		if (outgoing) gsap.set(outgoing, { clearProps: 'transform' });
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<QueryClientProvider client={queryClient}>
	<div bind:this={motion} class="navigation-flight" aria-hidden="true">
		<svg class="navigation-trace" viewBox="0 0 100 100" preserveAspectRatio="none">
			<path class="navigation-sweep" d="M0 0" />
			<path class="navigation-sweep-edge" d="M0 0" />
			<path class="shuttle-trail" d="M0 0" />
		</svg>
		<img class="shuttle-flight" src={shuttle} alt="" />
	</div>
	{#key page.params.clubId ?? 'public'}{@render children()}{/key}
	<Toast.Viewport position="bottom-right" max={5} label="Notifications" />
</QueryClientProvider>
