/* global gsap, Vue, MotionPathPlugin */
(function () {
	'use strict';

	const { createApp, onMounted, onBeforeUnmount, ref } = Vue;

	createApp({
		setup() {
			const clock = ref(null);
			const controls = ref(null);
			const stage = ref(null);
			const blackhole = ref(null);
			const particles = ref(null);
			const nowText = ref('');
			const minutes = ref(15);
			let clockTimer = null;
			let running = false;

			function pad(n) { return String(n).padStart(2, '0'); }
			function fmt(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
			function tick() { nowText.value = fmt(new Date()); }
			function startClock() { tick(); clockTimer = setInterval(tick, 1000); }
			function stopClock() { if (clockTimer) clearInterval(clockTimer); clockTimer = null; }

			function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
			function onWheelInput(e) {
				const delta = Math.sign(e.deltaY);
				minutes.value = clamp(minutes.value - delta, 1, 180);
			}
			function onKeySpin(e) {
				if (e.key === 'ArrowUp' || e.key === 'ArrowRight') minutes.value = clamp(minutes.value + 1, 1, 180);
				if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') minutes.value = clamp(minutes.value - 1, 1, 180);
			}

			function splitClockToParticles(totalSeconds) {
				const text = nowText.value || '';
				const rect = clock.value.getBoundingClientRect();
				const containerRect = document.body.getBoundingClientRect();
				const originX = rect.left + rect.width / 2 - containerRect.left;
				const originY = rect.top + rect.height / 2 - containerRect.top;

				const chars = text.split('');
				const positions = [];
				const spans = [];
				clock.value.innerHTML = '';
				chars.forEach((ch) => {
					const s = document.createElement('span');
					s.textContent = ch;
					s.style.display = 'inline-block';
					s.style.opacity = '1';
					spans.push(s);
					clock.value.appendChild(s);
				});
				spans.forEach((s) => {
					const r = s.getBoundingClientRect();
					positions.push({ x: r.left + r.width / 2 - containerRect.left, y: r.top + r.height / 2 - containerRect.top });
				});
				clock.value.textContent = '';

				const total = totalSeconds;
				const list = [];
				for (let i = 0; i < total; i++) {
					const seed = positions[i % Math.max(positions.length, 1)] || { x: originX, y: originY };
					const p = document.createElement('div');
					p.className = 'particle';
					particles.value.appendChild(p);
					gsap.set(p, { x: seed.x, y: seed.y, xPercent: -50, yPercent: -50 });
					list.push(p);
				}

				const stageRect = stage.value.getBoundingClientRect();
				const cx = stageRect.left + stageRect.width / 2;
				const cy = stageRect.top + stageRect.height / 2;
				const minR = Math.min(stageRect.width, stageRect.height) * 0.22;
				const maxR = Math.min(stageRect.width, stageRect.height) * 0.44;

				gsap.to(spans, { opacity: 0, duration: 0.4, stagger: 0.02, ease: 'power2.out' });
				gsap.fromTo(list, { scale: 0.6, opacity: 0 }, {
					scale: 1,
					opacity: 1,
					duration: 0.6,
					stagger: { each: Math.min(0.002, 0.7 / Math.max(1, list.length)), from: 'random' },
					ease: 'power2.out',
					x: (i) => { const a = (i / list.length) * Math.PI * 2 * 4 + Math.random() * 0.6; const r = minR + (maxR - minR) * Math.random(); return cx + Math.cos(a) * r; },
					y: (i) => { const a = (i / list.length) * Math.PI * 2 * 4 + Math.random() * 0.6; const r = minR + (maxR - minR) * Math.random(); return cy + Math.sin(a) * r; }
				});

				return { particles: list, center: { x: cx, y: cy } };
			}

			function circlePath(cx, cy, r) {
				const p1x = cx + r; const p1y = cy; const p2x = cx - r; const p2y = cy;
				return `M ${p1x},${p1y} A ${r},${r} 0 1 0 ${p2x},${p2y} A ${r},${r} 0 1 0 ${p1x},${p1y}`;
			}

			async function orbitAndAbsorb(list, center) {
				const absorbed = new Set();
				list.forEach((p) => {
					const x = gsap.getProperty(p, 'x');
					const y = gsap.getProperty(p, 'y');
					const r = Math.hypot(x - center.x, y - center.y);
					const duration = gsap.utils.clamp(6, 18, gsap.utils.mapRange(40, 260, 18, 6, r));
					if (MotionPathPlugin) {
						gsap.to(p, { motionPath: { path: circlePath(center.x, center.y, r), alignOrigin: [0.5, 0.5] }, duration, repeat: -1, ease: 'none' });
					}
				});

				for (let i = 0; i < list.length; i++) {
					await new Promise(r => setTimeout(r, 1000));
					let target = null, best = Infinity;
					for (let j = 0; j < list.length; j++) {
						if (absorbed.has(j)) continue;
						const p = list[j];
						const x = gsap.getProperty(p, 'x');
						const y = gsap.getProperty(p, 'y');
						const d = Math.hypot(x - center.x, y - center.y);
						if (d < best) { best = d; target = j; }
					}
					if (target == null) continue;
					absorbed.add(target);
					const p = list[target];
					gsap.to(p, { x: center.x, y: center.y, scale: 0.2, opacity: 0, duration: 0.5, ease: 'power3.in', onComplete: () => p.remove() });
				}
			}

			async function startTimerSequence() {
				if (running) return; running = true;
				stopClock();
				gsap.to(controls.value, { y: 30, opacity: 0, duration: 0.4, ease: 'power2.in' });
				gsap.to(stage.value, { opacity: 1, duration: 0.6, ease: 'power2.out' });
				const totalSeconds = minutes.value * 60;
				const { particles: list, center } = splitClockToParticles(totalSeconds);
				await orbitAndAbsorb(list, center);
				await new Promise(res => gsap.to(blackhole.value, { scale: 0.6, opacity: 0, duration: 0.8, ease: 'power3.in', onComplete: res }));
				gsap.set(blackhole.value, { clearProps: 'all' });
				gsap.to(stage.value, { opacity: 0, duration: 0.5, ease: 'power2.out' });
				startClock();
				gsap.fromTo(controls.value, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
				running = false;
			}

			onMounted(() => {
				if (window.MotionPathPlugin) gsap.registerPlugin(MotionPathPlugin);
				startClock();
			});
			onBeforeUnmount(() => { stopClock(); });

			return { clock, controls, stage, blackhole, particles, nowText, minutes, onWheelInput, onKeySpin, startTimerSequence };
		}
	}).mount('#app');
})();

