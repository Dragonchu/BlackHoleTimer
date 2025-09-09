/* global gsap */
(function () {
	'use strict';

	const clockEl = document.getElementById('clock');
	const stageEl = document.getElementById('stage');
	const particlesEl = document.getElementById('particles');
	const startBtn = document.getElementById('start-btn');
	const wheelEl = document.getElementById('wheel');

	// Register GSAP plugins if available
	if (window.MotionPathPlugin) {
		gsap.registerPlugin(MotionPathPlugin);
	}

	let nowClockTimer = null;
	let countdownSeconds = 15 * 60; // default 15 minutes
	let countdownActive = false;

	function pad(num) { return num.toString().padStart(2, '0'); }

	function formatTime(d) {
		const hh = pad(d.getHours());
		const mm = pad(d.getMinutes());
		const ss = pad(d.getSeconds());
		return `${hh}:${mm}:${ss}`;
	}

	function updateClock() {
		clockEl.textContent = formatTime(new Date());
	}

	function startRealtimeClock() {
		updateClock();
		nowClockTimer = setInterval(updateClock, 1000);
	}

	function stopRealtimeClock() {
		if (nowClockTimer) clearInterval(nowClockTimer);
		nowClockTimer = null;
	}

	function clamp(val, min, max) { return Math.min(max, Math.max(min, val)); }

	function onWheelInput(e) {
		const delta = Math.sign(e.deltaY);
		const minutes = parseInt(wheelEl.textContent, 10);
		let next = minutes - delta; // scroll up decreases deltaY negative => +1
		next = clamp(next, 1, 180);
		wheelEl.textContent = String(next);
		wheelEl.setAttribute('aria-valuenow', String(next));
		countdownSeconds = next * 60;
		e.preventDefault();
	}

	function onKeySpin(e) {
		if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
			wheelEl.dispatchEvent(new WheelEvent('wheel', { deltaY: -1 }));
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
			wheelEl.dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
		}
	}

	function splitClockToParticles() {
		// Capture the clock digits and create particles from each char glyph position
		const text = clockEl.textContent || '';
		const rect = clockEl.getBoundingClientRect();
		const containerRect = document.body.getBoundingClientRect();

		const originX = rect.left + rect.width / 2 - containerRect.left;
		const originY = rect.top + rect.height / 2 - containerRect.top;

		const chars = text.split('');
		const charPositions = [];
		const tempSpans = [];
		clockEl.innerHTML = '';
		chars.forEach((ch) => {
			const span = document.createElement('span');
			span.textContent = ch;
			span.style.display = 'inline-block';
			span.style.opacity = '1';
			tempSpans.push(span);
			clockEl.appendChild(span);
		});

		tempSpans.forEach((span) => {
			const r = span.getBoundingClientRect();
			charPositions.push({
				x: r.left + r.width / 2 - containerRect.left,
				y: r.top + r.height / 2 - containerRect.top
			});
		});

		// Restore empty clock; particles will represent time now
		clockEl.textContent = '';

		const totalParticles = countdownSeconds; // one particle per second
		const particles = [];

		// Seed particles starting near glyph positions, then they'll fly outward to orbits
		for (let i = 0; i < totalParticles; i++) {
			const seed = charPositions[i % Math.max(charPositions.length, 1)] || { x: originX, y: originY };
			const p = document.createElement('div');
			p.className = 'particle';
			particlesEl.appendChild(p);
			gsap.set(p, { x: seed.x, y: seed.y });
			particles.push(p);
		}

		// Stagger explode from glyph into orbit ring positions
		const stageRect = stageEl.getBoundingClientRect();
		const cx = stageRect.left + stageRect.width / 2; // absolute center
		const cy = stageRect.top + stageRect.height / 2;

		const minR = Math.min(stageRect.width, stageRect.height) * 0.22;
		const maxR = Math.min(stageRect.width, stageRect.height) * 0.44;

		gsap.set(particles, { xPercent: -50, yPercent: -50 });

		gsap.to(tempSpans, {
			opacity: 0,
			duration: 0.4,
			stagger: 0.02,
			ease: 'power2.out'
		});

		gsap.fromTo(
			particles,
			{ scale: 0.6, opacity: 0 },
			{
				scale: 1,
				opacity: 1,
				duration: 0.6,
				stagger: {
					each: Math.min(0.002, 0.7 / Math.max(1, particles.length)),
					from: 'random'
				},
				ease: 'power2.out',
				x: (i) => {
					const a = (i / particles.length) * Math.PI * 2 * 4 + Math.random() * 0.6;
					const r = minR + (maxR - minR) * Math.random();
					return cx + Math.cos(a) * r;
				},
				y: (i) => {
					const a = (i / particles.length) * Math.PI * 2 * 4 + Math.random() * 0.6;
					const r = minR + (maxR - minR) * Math.random();
					return cy + Math.sin(a) * r;
				}
			}
		);

		return { particles, center: { x: cx, y: cy }, radius: { min: minR, max: maxR } };
	}

	function showBlackHole() {
		gsap.to(stageEl, { opacity: 1, duration: 0.6, ease: 'power2.out' });
	}

	function hideControls() {
		gsap.to('#controls', { y: 30, opacity: 0, duration: 0.4, ease: 'power2.in' });
	}

	function restoreControls() {
		gsap.fromTo('#controls', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
	}

	function circlePath(cx, cy, r) {
		const p1x = cx + r;
		const p1y = cy;
		const p2x = cx - r;
		const p2y = cy;
		return `M ${p1x},${p1y} A ${r},${r} 0 1 0 ${p2x},${p2y} A ${r},${r} 0 1 0 ${p1x},${p1y}`;
	}

	async function runOrbitAndAbsorb(particles, center) {
		// Orbiting loop: schedule per-second absorption
		const total = particles.length;
		const absorbed = new Set();

		// Create perpetual orbits with varying angular velocities
		particles.forEach((p) => {
			const px = gsap.getProperty(p, 'x');
			const py = gsap.getProperty(p, 'y');
			const radius = Math.hypot((px) - center.x, (py) - center.y);
			const duration = gsap.utils.clamp(6, 18, gsap.utils.mapRange(40, 260, 18, 6, radius));
			const path = circlePath(center.x, center.y, radius);
			if (window.MotionPathPlugin) {
				gsap.to(p, {
					motionPath: {
						path,
						alignOrigin: [0.5, 0.5]
					},
					duration,
					repeat: -1,
					ease: 'none'
				});
			} else {
				// Fallback: rotate around center using an angle tween
				const state = { angle: Math.random() * Math.PI * 2, r: radius };
				gsap.to(state, {
					angle: state.angle + Math.PI * 2,
					duration,
					repeat: -1,
					ease: 'none',
					onUpdate: () => {
						gsap.set(p, {
							x: center.x + Math.cos(state.angle) * state.r,
							y: center.y + Math.sin(state.angle) * state.r
						});
					}
				});
			}
		});

		// Absorb one particle per second
		for (let i = 0; i < total; i++) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			// pick a visible, not yet absorbed particle nearest to an inner radius
			let target = null;
			let best = Infinity;
			for (let j = 0; j < particles.length; j++) {
				if (absorbed.has(j)) continue;
				const p = particles[j];
				const x = gsap.getProperty(p, 'x');
				const y = gsap.getProperty(p, 'y');
				const dx = (x) - center.x;
				const dy = (y) - center.y;
				const r = Math.hypot(dx, dy);
				if (r < best) { best = r; target = j; }
			}
			if (target == null) continue;
			absorbed.add(target);
			const p = particles[target];
			gsap.to(p, {
				x: center.x,
				y: center.y,
				scale: 0.2,
				opacity: 0,
				duration: 0.5,
				ease: 'power3.in',
				onComplete: () => p.remove()
			});
		}
	}

	async function collapseBlackHole() {
		await new Promise((resolve) => {
			gsap.to('#blackhole', { scale: 0.6, opacity: 0, duration: 0.8, ease: 'power3.in', onComplete: resolve });
		});
		gsap.set('#blackhole', { clearProps: 'all' });
		gsap.to(stageEl, { opacity: 0, duration: 0.5, ease: 'power2.out' });
	}

	async function runTimerSequence() {
		if (countdownActive) return;
		countdownActive = true;
		stopRealtimeClock();
		hideControls();
		showBlackHole();
		const { particles, center } = splitClockToParticles();
		await runOrbitAndAbsorb(particles, center);
		await collapseBlackHole();
		// restore UI
		startRealtimeClock();
		restoreControls();
		countdownActive = false;
	}

	function init() {
		startRealtimeClock();
		wheelEl.addEventListener('wheel', onWheelInput, { passive: false });
		wheelEl.addEventListener('keydown', onKeySpin);
		startBtn.addEventListener('click', runTimerSequence);
	}

	window.addEventListener('DOMContentLoaded', init);
})();

