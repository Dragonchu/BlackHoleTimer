<template>
	<div id="app" v-cloak>
		<div id="clock-wrapper">
			<div id="clock" ref="clock">{{ nowText }}</div>
		</div>

		<div id="controls" ref="controls">
			<button id="start-btn" aria-label="开始计时" @click="startTimerSequence">开始计时</button>
			<div id="duration">
				<div class="label">分钟</div>
				<div id="wheel" ref="wheel" tabindex="0" role="spinbutton" :aria-valuemin="1" :aria-valuemax="180" :aria-valuenow="minutes" aria-label="倒计时分钟设置" @wheel.prevent="onWheelInput" @keydown="onKeySpin">{{ minutes }}</div>
			</div>
		</div>

		<div id="stage" ref="stage" aria-hidden="true">
			<div id="blackhole" ref="blackhole">
				<div class="accretion"></div>
				<div class="core"></div>
				<div class="centerHover" ref="centerHover"><span>ENTER</span></div>
			</div>
			<div id="particles" ref="particles"></div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(MotionPathPlugin);

const clock = ref(null);
const controls = ref(null);
const stage = ref(null);
const blackhole = ref(null);
const centerHover = ref(null);
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
		const sizeScale = 0.8 + Math.random() * 0.8; // 0.8x - 1.6x
		gsap.set(p, { x: seed.x, y: seed.y, xPercent: -50, yPercent: -50, scale: sizeScale });
		list.push(p);
	}

	const stageRect = stage.value.getBoundingClientRect();
	const cx = stageRect.left + stageRect.width / 2;
	const cy = stageRect.top + stageRect.height / 2;

	// Screen-fill distribution using aspect-correct grid with jitter
	const particleCount = list.length;
	const aspect = stageRect.width / stageRect.height;
	const cols = Math.ceil(Math.sqrt(particleCount * aspect));
	const rows = Math.ceil(particleCount / cols);
	const cellW = stageRect.width / cols;
	const cellH = stageRect.height / rows;
	const jitterX = Math.min(60, cellW * 0.45);
	const jitterY = Math.min(60, cellH * 0.45);

	gsap.to(spans, { opacity: 0, duration: 0.35, stagger: 0.015, ease: 'power2.out' });
	gsap.fromTo(list, { scale: (i, t) => gsap.getProperty(t, 'scale'), opacity: 0 }, {
		scale: 1,
		opacity: 1,
		duration: 0.9,
		stagger: { each: Math.min(0.0012, 0.5 / Math.max(1, list.length)), from: 'random' },
		ease: 'power3.out',
		x: (i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const baseX = stageRect.left + col * cellW + cellW * 0.5;
			return baseX + (Math.random() * 2 - 1) * jitterX;
		},
		y: (i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const baseY = stageRect.top + row * cellH + cellH * 0.5;
			return baseY + (Math.random() * 2 - 1) * jitterY;
		}
	});

	return { list, center: { x: cx, y: cy } };
}

async function orbitAndAbsorb(list, center) {
	// Irregular swarm orbit with breathing radius and noise drift
	const setters = list.map((p) => ({ setX: gsap.quickSetter(p, 'x', 'px'), setY: gsap.quickSetter(p, 'y', 'px') }));
	const states = list.map((p) => {
		const x = Number(gsap.getProperty(p, 'x'));
		const y = Number(gsap.getProperty(p, 'y'));
		const baseR = Math.hypot(x - center.x, y - center.y);
		return {
			active: true,
			angle: Math.random() * Math.PI * 2,
			baseR,
			radiusAmp: 40 + Math.random() * 140,
			radiusSpeed: 0.2 + Math.random() * 0.6,
			angleSpeed: (0.25 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1),
			xAmp: 20 + Math.random() * 80,
			yAmp: 20 + Math.random() * 80,
			xFreq: 0.25 + Math.random() * 0.8,
			yFreq: 0.25 + Math.random() * 0.8,
			phaseX: Math.random() * Math.PI * 2,
			phaseY: Math.random() * Math.PI * 2
		};
	});

	let time = 0;
	const ticker = (dt) => {
		const t = (dt || 16.7) / 1000;
		time += t;
		for (let i = 0; i < list.length; i++) {
			const s = states[i];
			if (!s.active) continue;
			s.angle += s.angleSpeed * t;
			const r = s.baseR + Math.sin(time * s.radiusSpeed + i * 0.19) * s.radiusAmp;
			const nx = Math.sin(time * s.xFreq + s.phaseX) * s.xAmp;
			const ny = Math.cos(time * s.yFreq + s.phaseY) * s.yAmp;
			const x = center.x + Math.cos(s.angle) * r + nx;
			const y = center.y + Math.sin(s.angle) * r + ny;
			setters[i].setX(x);
			setters[i].setY(y);
		}
	};
	gsap.ticker.add(ticker);

	const absorbed = new Set();
	for (let i = 0; i < list.length; i++) {
		await new Promise(r => setTimeout(r, 1000));
		let target = null, best = Infinity;
		for (let j = 0; j < list.length; j++) {
			if (absorbed.has(j) || !states[j].active) continue;
			const x = Number(gsap.getProperty(list[j], 'x'));
			const y = Number(gsap.getProperty(list[j], 'y'));
			const d = Math.hypot(x - center.x, y - center.y);
			if (d < best) { best = d; target = j; }
		}
		if (target == null) continue;
		absorbed.add(target);
		states[target].active = false;
		const p = list[target];
		gsap.to(p, { x: center.x, y: center.y, scale: 0.35, opacity: 0, duration: 0.6, ease: 'power3.in', onComplete: () => p.remove() });
	}

	gsap.ticker.remove(ticker);
}

async function startTimerSequence() {
	if (running) return; running = true;
	stopClock();
	gsap.to(controls.value, { y: 30, opacity: 0, duration: 0.4, ease: 'power2.in' });
	gsap.to(stage.value, { opacity: 1, duration: 0.6, ease: 'power2.out' });
	gsap.fromTo(centerHover.value, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' });
	const totalSeconds = minutes.value * 60;
	const { list, center } = splitClockToParticles(totalSeconds);
	await orbitAndAbsorb(list, center);
	await new Promise(res => gsap.to(blackhole.value, { scale: 0.6, opacity: 0, duration: 0.8, ease: 'power3.in', onComplete: res }));
	gsap.set(blackhole.value, { clearProps: 'all' });
	gsap.to(stage.value, { opacity: 0, duration: 0.5, ease: 'power2.out' });
	gsap.to(centerHover.value, { opacity: 0, duration: 0.4, ease: 'power2.in' });
	startClock();
	gsap.fromTo(controls.value, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
	running = false;
}

onMounted(() => { startClock(); });
onBeforeUnmount(() => { stopClock(); });
</script>

<style scoped>
[v-cloak] { display: none; }
</style>
