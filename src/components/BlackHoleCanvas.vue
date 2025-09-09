<template>
	<div id="blackhole" ref="root">
		<div class="centerHover" ref="center" @click="onClick" @mouseover="onOver" @mouseout="onOut"><span>ENTER</span></div>
		<canvas ref="canvas"></canvas>
	</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose } from 'vue';

const root = ref(null);
const center = ref(null);
const canvas = ref(null);
defineExpose({ rootEl: root });

let ctx;
let width = 0;
let height = 0;
let centerX = 0;
let centerY = 0;
let maxOrbit = 255;
let running = false;
let collapse = false;
let expanse = false;
let startTime = 0;
let currentTime = 0;
let stars = [];

function setDPI(dpi) {
	const c = canvas.value;
	if (!c.style.width) c.style.width = c.width + 'px';
	if (!c.style.height) c.style.height = c.height + 'px';
	const scaleFactor = dpi / 96;
	c.width = Math.ceil(c.width * scaleFactor);
	c.height = Math.ceil(c.height * scaleFactor);
	ctx = c.getContext('2d');
	ctx.scale(scaleFactor, scaleFactor);
}

function rotate(cx, cy, x, y, angle) {
	const radians = angle;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const nx = (cos * (x - cx)) + (sin * (y - cy)) + cx;
	const ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
	return [nx, ny];
}

class Star {
	constructor(id) {
		// weighted random towards center
		const r1 = Math.random() * (maxOrbit / 2) + 1;
		const r2 = Math.random() * (maxOrbit / 2) + maxOrbit;
		this.orbital = (r1 + r2) / 2;
		this.x = centerX;
		this.y = centerY + this.orbital;
		this.yOrigin = centerY + this.orbital;
		this.speed = (Math.floor(Math.random() * 2.5) + 1.5) * Math.PI / 180;
		this.rotation = 0;
		this.startRotation = (Math.floor(Math.random() * 360) + 1) * Math.PI / 180;
		this.id = id;
		this.collapseBonus = Math.max(0, this.orbital - (maxOrbit * 0.7));
		this.color = `rgba(255,255,255,${1 - (this.orbital / 255)})`;
		this.hoverPos = centerY + (maxOrbit / 2) + this.collapseBonus;
		this.expansePos = centerY + (this.id % 100) * -10 + (Math.floor(Math.random() * 20) + 1);
		this.prevR = this.startRotation;
		this.prevX = this.x;
		this.prevY = this.y;
	}

	draw() {
		if (!expanse) {
			this.rotation = this.startRotation + (currentTime * this.speed);
			if (!collapse) {
				if (this.y > this.yOrigin) this.y -= 2.5;
				if (this.y < this.yOrigin - 4) this.y += (this.yOrigin - this.y) / 10;
			} else {
				if (this.y > this.hoverPos) this.y -= (this.hoverPos - this.y) / -5;
				if (this.y < this.hoverPos - 4) this.y += 2.5;
			}
		} else {
			this.rotation = this.startRotation + (currentTime * (this.speed / 2));
			if (this.y > this.expansePos) this.y -= Math.floor(this.expansePos - this.y) / -140;
		}

		ctx.save();
		ctx.fillStyle = this.color;
		ctx.strokeStyle = this.color;
		ctx.beginPath();
		const oldPos = rotate(centerX, centerY, this.prevX, this.prevY, -this.prevR);
		ctx.moveTo(oldPos[0], oldPos[1]);
		ctx.translate(centerX, centerY);
		ctx.rotate(this.rotation);
		ctx.translate(-centerX, -centerY);
		ctx.lineTo(this.x, this.y);
		ctx.stroke();
		ctx.restore();

		this.prevR = this.rotation;
		this.prevX = this.x;
		this.prevY = this.y;
	}
}

function loop() {
	if (!running) return;
	const now = Date.now();
	currentTime = (now - startTime) / 50;
	ctx.fillStyle = 'rgba(25,25,25,0.2)';
	ctx.fillRect(0, 0, width, height);
	for (let i = 0; i < stars.length; i++) {
		stars[i].draw();
	}
	requestAnimationFrame(loop);
}

function init() {
	const c = canvas.value;
	width = root.value.clientWidth;
	height = root.value.clientHeight;
	c.width = width;
	c.height = height;
	centerX = width / 2;
	centerY = height / 2;
	ctx = c.getContext('2d');
	ctx.globalCompositeOperation = 'multiply';
	setDPI(192);
	ctx.fillStyle = 'rgba(25,25,25,1)';
	ctx.fillRect(0, 0, width, height);
	stars = [];
	for (let i = 0; i < 2500; i++) stars.push(new Star(i));
	startTime = Date.now();
	running = true;
	requestAnimationFrame(loop);
}

function onClick() {
	collapse = false;
	expanse = true;
	center.value.classList.add('open');
}
function onOver() { if (!expanse) collapse = true; }
function onOut() { if (!expanse) collapse = false; }

function onResize() {
	running = false;
	setTimeout(() => { init(); }, 50);
}

onMounted(() => {
	init();
	window.addEventListener('resize', onResize);
	root.value.addEventListener('mousemove', () => {});
});
onBeforeUnmount(() => {
	running = false;
	window.removeEventListener('resize', onResize);
});
</script>

<style scoped>
/* Canvas fills container, z-index under centerHover */
canvas { position: relative; z-index: 1; width: 100%; height: 100%; margin: auto; display: block; }

#blackhole { height: 100%; width: 100%; position: relative; display: flex; }

.centerHover { width: 255px; height: 255px; background-color: transparent; border-radius: 50%; position: absolute; left: 50%; top: 50%; margin-top: -128px; margin-left: -128px; z-index: 2; cursor: pointer; line-height: 255px; text-align: center; transition: all 500ms; }
.centerHover.open { opacity: 0; pointer-events: none; }
.centerHover:hover span { color: #DDD; }
.centerHover:hover span:before { background-color: #DDD; }
.centerHover:hover span:after { background-color: #DDD; }
.centerHover span { color: #666; font-family: serif; font-size: 18px; position: relative; transition: all 500ms; }
.centerHover span:before { content: ''; display: inline-block; height: 1px; width: 16px; margin-right: 12px; margin-bottom: 4px; background-color: #666; transition: all 500ms; }
.centerHover span:after { content: ''; display: inline-block; height: 1px; width: 16px; margin-left: 12px; margin-bottom: 4px; background-color: #666; transition: all 500ms; }
</style>

