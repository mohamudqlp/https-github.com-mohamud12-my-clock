const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const speedEl = document.getElementById('speed');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start-btn');

const laneCount = 3;
const roadPadding = 28;
const laneWidth = (canvas.width - roadPadding * 2) / laneCount;
const cheatCode = 'MARIO3DLAND';

const player = {
  lane: 1,
  width: laneWidth * 0.56,
  height: 96,
  y: canvas.height - 132,
};

let enemies = [];
let score = 0;
let highScore = Number(localStorage.getItem('carGameHighScore')) || 0;
let speed = 4.4;
let spawnTimer = 0;
let gameOver = true;
let animationFrame;
let lastTimestamp = 0;
let keyBuffer = '';
let cheatActive = false;
let cheatTimerMs = 0;

highScoreEl.textContent = highScore.toString();

function laneCenterX(laneIndex) {
  return roadPadding + laneWidth * laneIndex + laneWidth / 2;
}

function drawRoad() {
  ctx.fillStyle = '#2f2f2f';
  ctx.fillRect(roadPadding, 0, canvas.width - roadPadding * 2, canvas.height);

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(roadPadding, 0);
  ctx.lineTo(roadPadding, canvas.height);
  ctx.moveTo(canvas.width - roadPadding, 0);
  ctx.lineTo(canvas.width - roadPadding, canvas.height);
  ctx.stroke();

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  ctx.setLineDash([24, 24]);

  for (let i = 1; i < laneCount; i += 1) {
    const x = roadPadding + laneWidth * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

function drawPlayer() {
  const x = laneCenterX(player.lane) - player.width / 2;

  ctx.fillStyle = cheatActive ? '#34d399' : '#60a5fa';
  ctx.fillRect(x, player.y, player.width, player.height);

  ctx.fillStyle = cheatActive ? '#047857' : '#1e40af';
  ctx.fillRect(x + 6, player.y + 10, player.width - 12, player.height - 20);

  ctx.fillStyle = '#dbeafe';
  ctx.fillRect(x + 8, player.y + 20, player.width - 16, 18);
}

function drawEnemy(enemy) {
  const x = laneCenterX(enemy.lane) - enemy.width / 2;

  ctx.fillStyle = enemy.color;
  ctx.fillRect(x, enemy.y, enemy.width, enemy.height);

  ctx.fillStyle = '#111827';
  ctx.fillRect(x + 7, enemy.y + 12, enemy.width - 14, enemy.height - 24);
}

function spawnEnemy() {
  const lane = Math.floor(Math.random() * laneCount);

  enemies.push({
    lane,
    y: -130,
    width: player.width,
    height: player.height,
    color: ['#f87171', '#fb7185', '#f97316'][Math.floor(Math.random() * 3)],
  });
}

function intersects(enemy) {
  if (enemy.lane !== player.lane) return false;

  const enemyTop = enemy.y;
  const enemyBottom = enemy.y + enemy.height;
  const playerTop = player.y;
  const playerBottom = player.y + player.height;

  return enemyBottom >= playerTop + 8 && enemyTop <= playerBottom - 8;
}

function activateCheat() {
  cheatActive = true;
  cheatTimerMs = 10000;
  statusEl.classList.remove('game-over');
  statusEl.textContent = 'Cheat enabled: MARIO3DLAND activated! Invincibility for 10 seconds.';
}

function handleCheatTyping(key) {
  if (!/^[a-z0-9]$/i.test(key)) {
    return;
  }

  keyBuffer = (keyBuffer + key.toUpperCase()).slice(-cheatCode.length);

  if (!gameOver && keyBuffer.endsWith(cheatCode)) {
    activateCheat();
    keyBuffer = '';
  }
}

function update(deltaMs) {
  const delta = deltaMs / 16.67;
  spawnTimer += deltaMs;

  const spawnInterval = Math.max(420, 1100 - score * 2.5);
  if (spawnTimer >= spawnInterval) {
    spawnEnemy();
    spawnTimer = 0;
  }

  speed = Math.min(12.5, 4.4 + score / 155);
  speedEl.textContent = `${(speed / 4.4).toFixed(1)}x`;

  if (cheatActive) {
    cheatTimerMs -= deltaMs;
    if (cheatTimerMs <= 0) {
      cheatActive = false;
      statusEl.textContent = 'Cheat expired. Drive carefully!';
    }
  }

  for (const enemy of enemies) {
    enemy.y += speed * delta;

    if (!cheatActive && intersects(enemy)) {
      endGame();
      return;
    }
  }

  enemies = enemies.filter((enemy) => enemy.y < canvas.height + 140);
  score += delta * (cheatActive ? 0.35 : 0.22);
  scoreEl.textContent = Math.floor(score).toString();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawRoad();

  for (const enemy of enemies) {
    drawEnemy(enemy);
  }

  drawPlayer();
}

function loop(timestamp) {
  if (gameOver) return;

  const delta = lastTimestamp ? timestamp - lastTimestamp : 16.67;
  lastTimestamp = timestamp;

  update(delta);
  render();

  if (!gameOver) {
    animationFrame = requestAnimationFrame(loop);
  }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animationFrame);

  const finalScore = Math.floor(score);
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('carGameHighScore', highScore.toString());
    highScoreEl.textContent = highScore.toString();
  }

  statusEl.classList.add('game-over');
  statusEl.textContent = `Game over. Score: ${finalScore}. Press Start Game to play again.`;
  startBtn.textContent = 'Play Again';
}

function startGame() {
  cancelAnimationFrame(animationFrame);

  gameOver = false;
  score = 0;
  speed = 4.4;
  spawnTimer = 0;
  enemies = [];
  player.lane = 1;
  lastTimestamp = 0;
  cheatActive = false;
  cheatTimerMs = 0;
  keyBuffer = '';

  scoreEl.textContent = '0';
  speedEl.textContent = '1.0x';
  statusEl.classList.remove('game-over');
  statusEl.textContent = 'Good luck! Type MARIO3DLAND during a run for a temporary cheat mode.';
  startBtn.textContent = 'Restart Game';

  render();
  animationFrame = requestAnimationFrame(loop);
}

function handleMoveLeft() {
  if (!gameOver) {
    player.lane = Math.max(0, player.lane - 1);
  }
}

function handleMoveRight() {
  if (!gameOver) {
    player.lane = Math.min(laneCount - 1, player.lane + 1);
  }
}

window.addEventListener('keydown', (event) => {
  handleCheatTyping(event.key);

  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
    handleMoveLeft();
  }

  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
    handleMoveRight();
  }
});

startBtn.addEventListener('click', startGame);
render();
