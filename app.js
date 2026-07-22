const canvas = document.querySelector('#stage');
const ctx = canvas.getContext('2d');

const controls = {
  playPause: document.querySelector('#play-pause'),
  reset: document.querySelector('#reset'),
  randomize: document.querySelector('#randomize'),
  direction: document.querySelector('#direction'),
  speed: document.querySelector('#speed'),
  stride: document.querySelector('#stride'),
  style: document.querySelector('#style'),
  runtimeState: document.querySelector('#runtime-state'),
  directionValue: document.querySelector('#direction-value'),
  speedValue: document.querySelector('#speed-value'),
  strideValue: document.querySelector('#stride-value'),
  styleValue: document.querySelector('#style-value'),
};

const styleProfiles = {
  balanced: { bounce: 1, lean: 1, stiffness: 0.55, color: '#70e1ff', label: 'Balanced' },
  stealth: { bounce: 0.35, lean: 0.7, stiffness: 0.85, color: '#8dffb0', label: 'Stealth' },
  athletic: { bounce: 1.45, lean: 1.35, stiffness: 0.38, color: '#ffcc70', label: 'Athletic' },
  robotic: { bounce: 0.15, lean: 0.25, stiffness: 1, color: '#9c7cff', label: 'Robotic' },
};

const actor = { x: canvas.width / 2, y: canvas.height / 2 + 54, phase: 0, playing: false };
const keys = new Set();
let lastTime = performance.now();

function readInputs() {
  return {
    direction: Number(controls.direction.value) * Math.PI / 180,
    speed: Number(controls.speed.value),
    stride: Number(controls.stride.value),
    profile: styleProfiles[controls.style.value],
  };
}

function syncLabels() {
  const style = styleProfiles[controls.style.value];
  controls.directionValue.textContent = `${controls.direction.value}°`;
  controls.speedValue.textContent = `${Number(controls.speed.value).toFixed(1)} m/s`;
  controls.strideValue.textContent = `${Number(controls.stride.value).toFixed(1)}x`;
  controls.styleValue.textContent = style.label;
  controls.runtimeState.textContent = actor.playing ? 'Running' : 'Paused';
  controls.playPause.textContent = actor.playing ? '⏸ Pause' : '▶ Play';
}

function resetActor() {
  actor.x = canvas.width / 2;
  actor.y = canvas.height / 2 + 54;
  actor.phase = 0;
}

function randomizeMotion() {
  controls.direction.value = Math.round(Math.random() * 360 - 180);
  controls.speed.value = (Math.random() * 2.6 + 0.2).toFixed(1);
  controls.stride.value = (Math.random() * 1.2 + 0.5).toFixed(1);
  const styles = Object.keys(styleProfiles);
  controls.style.value = styles[Math.floor(Math.random() * styles.length)];
  actor.playing = true;
  syncLabels();
}

function applyKeyboardDirection() {
  let dx = 0;
  let dy = 0;
  if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
  if (keys.has('arrowright') || keys.has('d')) dx += 1;
  if (keys.has('arrowup') || keys.has('w')) dy -= 1;
  if (keys.has('arrowdown') || keys.has('s')) dy += 1;
  if (dx || dy) {
    controls.direction.value = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
    actor.playing = true;
    syncLabels();
  }
}

function drawGrid() {
  ctx.fillStyle = '#07101c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(112,225,255,.10)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
}

function limb(x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawActor(input) {
  const { profile, stride, speed, direction } = input;
  const cycle = actor.phase;
  const step = Math.sin(cycle) * 28 * stride;
  const counterStep = Math.sin(cycle + Math.PI) * 28 * stride;
  const bounce = Math.abs(Math.sin(cycle)) * 14 * profile.bounce * Math.min(speed, 1.7);
  const lean = Math.cos(direction) * 11 * speed * profile.lean;
  const hipY = actor.y - bounce;
  const torsoX = actor.x + lean;
  const torsoY = hipY - 78;
  const headY = torsoY - 42;
  const color = profile.color;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  limb(actor.x - 16, hipY, actor.x - 34 + step, hipY + 72, 13, color);
  limb(actor.x + 16, hipY, actor.x + 34 + counterStep, hipY + 72, 13, color);
  limb(actor.x, hipY, torsoX, torsoY, 18, '#e9f7ff');
  limb(torsoX - 12, torsoY + 12, torsoX - 45 + counterStep * .8, torsoY + 58, 10, color);
  limb(torsoX + 12, torsoY + 12, torsoX + 45 + step * .8, torsoY + 58, 10, color);
  ctx.fillStyle = '#e9f7ff';
  ctx.beginPath();
  ctx.arc(torsoX, headY, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(actor.x, actor.y + 96);
  ctx.lineTo(actor.x + Math.cos(direction) * 72, actor.y + 96 + Math.sin(direction) * 72);
  ctx.stroke();
}

function update(delta) {
  applyKeyboardDirection();
  const input = readInputs();
  if (actor.playing) {
    actor.phase += delta * (2.2 + input.speed) * (input.profile.stiffness + 0.45);
    actor.x += Math.cos(input.direction) * input.speed * delta * 64;
    actor.y += Math.sin(input.direction) * input.speed * delta * 64;
    actor.x = (actor.x + canvas.width) % canvas.width;
    actor.y = Math.min(canvas.height - 130, Math.max(170, actor.y));
  }
  drawGrid();
  drawActor(input);
}

function frame(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(delta);
  requestAnimationFrame(frame);
}

controls.playPause.addEventListener('click', () => { actor.playing = !actor.playing; syncLabels(); });
controls.reset.addEventListener('click', () => { resetActor(); actor.playing = false; syncLabels(); });
controls.randomize.addEventListener('click', randomizeMotion);
['direction', 'speed', 'stride', 'style'].forEach((id) => controls[id].addEventListener('input', syncLabels));
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  if (key === ' ') actor.playing = !actor.playing;
  if (key === 'r') resetActor();
  keys.add(key);
  syncLabels();
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

syncLabels();
requestAnimationFrame(frame);
