(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 480;
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  ctx.imageSmoothingEnabled = false;

  function fitCanvasDisplay() {
    const frame = canvas.closest('.game-frame');
    if (!frame) return;
    const availW = frame.clientWidth;
    if (availW <= 0) return;
    const scale = Math.min(1, availW / GAME_WIDTH);
    const w = Math.floor(GAME_WIDTH * scale);
    const h = Math.floor(GAME_HEIGHT * scale);
    if (canvas.style.width === `${w}px` && canvas.style.height === `${h}px`) return;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  let fitCanvasScheduled = false;
  function scheduleFitCanvasDisplay() {
    if (fitCanvasScheduled) return;
    fitCanvasScheduled = true;
    requestAnimationFrame(() => {
      fitCanvasScheduled = false;
      fitCanvasDisplay();
    });
  }

  const frameEl = canvas.closest('.game-frame');
  if (frameEl) {
    fitCanvasDisplay();
    new ResizeObserver(scheduleFitCanvasDisplay).observe(frameEl);
    window.addEventListener('resize', scheduleFitCanvasDisplay);
    document.addEventListener('ark3:start-game', scheduleFitCanvasDisplay);
  }
  const overlay = document.getElementById('overlay');
  const overlayContent = document.getElementById('overlay-content');
  const damageMessageEl = document.getElementById('damage-message');

  const DAMAGE_MESSAGE_DURATION = 90;
  const DAMAGE_MESSAGES = {
    crater: 'Fell into a crater!',
    alien: 'Hit by a hostile alien!',
    asteroid: 'Struck by an asteroid!',
    fall: 'Fell off the surface!',
  };

  let damageMessageTimer = 0;

  const GRAVITY = 0.55;
  const JUMP_FORCE = -11;
  const MOVE_SPEED = 4;
  const MAX_LIVES = 5;
  const INVINCIBLE_FRAMES = 90;
  const CAMERA_LEAD = 0.35;
  const CAMERA_SMOOTH = 0.12;
  const TARGET_FRAME_MS = 1000 / 60;

  const FLOOR_Y = 440;
  const COLLECT_FLOAT_Y = 422;

  const COLORS = {
    skyTop: '#2a0e42',
    skyMid: '#6a2860',
    skyBottom: '#d06030',
    sandLight: '#d4a574',
    sandMid: '#c49262',
    sandDark: '#a87048',
    sandDeep: '#7a5038',
    rockLight: '#9a8878',
    rockMid: '#7a6858',
    rockDark: '#5a4838',
    groundCrust: '#5c3020',
    groundDeep: '#3d1e14',
    crater: '#2a0a00',
    rover: '#c0c0c0',
    roverWheel: '#333',
    roverAntenna: '#ff4444',
    mineral: '#ffd700',
    microbe: '#44ff88',
    water: '#44aaff',
    alien: '#aa44ff',
    asteroid: '#888',
    star: '#fff8dc',
  };

  let state = 'menu';
  let lives = MAX_LIVES;
  let levelIndex = 0;
  let collected = { goodCells: 0, gems: 0, water: 0 };
  let score = 0;
  const POINTS_PER_COLLECTIBLE = 2;
  /** Testing only — set to 0 for normal play. Level 10 = index 9. */
  const DEV_START_LEVEL = 0;
  let invincibleTimer = 0;
  let frameCount = 0;
  let asteroidTimer = 0;
  let levelAdvanceTimer = 0;
  let pickupCooldown = 0;
  const LEVEL_COMPLETE_DELAY = 90;

  const keys = { left: false, right: false, up: false };

  let player = { x: 50, y: FLOOR_Y - 24, w: 32, h: 24, vx: 0, vy: 0, onGround: false, facing: 1 };
  let spawnX = 50;
  let cameraX = 0;
  let worldWidth = 800;
  let platforms = [];
  let craters = [];
  let aliens = [];
  let collectibles = [];
  let mineralRocks = [];
  let asteroids = [];

  const GOOD_FEEDBACK_DURATION = 30;
  const BAD_FEEDBACK_DURATION = 48;
  const BAD_SKY_FLASH_DURATION = 90;

  const feedback = {
    goodTimer: 0,
    badTimer: 0,
    goodBgFlash: 0,
    badBgFlash: 0,
    badSkyPulse: 0,
    roverGlow: 0,
    roverShake: 0,
    particles: [],
    burstStars: [],
    collectBursts: [],
    scorePopups: [],
    impactBursts: [],
  };

  function resetFeedback() {
    feedback.goodTimer = 0;
    feedback.badTimer = 0;
    feedback.goodBgFlash = 0;
    feedback.badBgFlash = 0;
    feedback.badSkyPulse = 0;
    feedback.roverGlow = 0;
    feedback.roverShake = 0;
    feedback.particles = [];
    feedback.burstStars = [];
    feedback.collectBursts = [];
    feedback.scorePopups = [];
    feedback.impactBursts = [];
  }

  function flashBackgroundGood() {
    feedback.goodBgFlash = GOOD_FEEDBACK_DURATION;
    feedback.burstStars = [];
    for (let i = 0; i < 20; i++) {
      feedback.burstStars.push({
        x: Math.random() * canvas.width,
        y: 8 + Math.random() * canvas.height * 0.5,
        size: 2 + Math.random() * 3,
        life: GOOD_FEEDBACK_DURATION,
        maxLife: GOOD_FEEDBACK_DURATION,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
  }

  function flashBackgroundBad() {
    feedback.badBgFlash = BAD_SKY_FLASH_DURATION;
    feedback.badSkyPulse = BAD_SKY_FLASH_DURATION;
  }

  function createImpactDebris(worldX, worldY, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + Math.random() * Math.PI;
      const speed = 2 + Math.random() * 7;
      const life = 18 + Math.floor(Math.random() * 16);
      feedback.particles.push({
        x: worldX + (Math.random() - 0.5) * 30,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        life,
        maxLife: life,
        size: 2 + Math.random() * 4,
        color: Math.random() > 0.45 ? '#ff6622' : '#cc4422',
        kind: 'debris',
      });
    }
  }

  function triggerAsteroidExplosion(a) {
    const impactY = FLOOR_Y - 6;
    a.phase = 'explode';
    a.explodeTimer = 0;
    a.explodeMax = 32;
    a.impactY = impactY;
    createImpactDebris(a.x, impactY, 28);
    createRedSparks(a.x, impactY, 12);
    feedback.impactBursts.push({
      x: a.x,
      y: impactY,
      timer: 30,
      maxTimer: 30,
    });
  }

  function createSparkles(worldX, worldY, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      const life = 14 + Math.floor(Math.random() * 10);
      feedback.particles.push({
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life,
        maxLife: life,
        size: 2 + Math.random() * 2,
        color: Math.random() > 0.4 ? '#ffd700' : '#ffffff',
        kind: 'sparkle',
      });
    }
  }

  function createRedSparks(worldX, worldY, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      const life = 16 + Math.floor(Math.random() * 12);
      feedback.particles.push({
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life,
        maxLife: life,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.5 ? '#ff3333' : '#ff6600',
        kind: 'redSpark',
      });
    }
  }

  function spawnScorePopup(worldX, worldY, points, type) {
    const colors = {
      microbe: '#c8ff4a',
      mineral: '#ff7bff',
      water: '#5ef0ff',
    };
    feedback.scorePopups.push({
      x: worldX,
      y: worldY,
      vy: -2.1,
      points,
      color: colors[type] || '#fff44a',
      life: 62,
      maxLife: 62,
    });
  }

  function triggerGoodFeedback(worldX, worldY) {
    feedback.goodTimer = GOOD_FEEDBACK_DURATION;
    feedback.roverGlow = GOOD_FEEDBACK_DURATION;
    flashBackgroundGood();
    createSparkles(player.x + player.w / 2, player.y + player.h / 2, 14);
    createSparkles(worldX, worldY, 10);
    feedback.collectBursts.push({
      x: worldX,
      y: worldY,
      timer: 22,
      maxTimer: 22,
    });
  }

  function triggerBadFeedback() {
    feedback.badTimer = BAD_FEEDBACK_DURATION;
    feedback.roverShake = BAD_FEEDBACK_DURATION;
    flashBackgroundBad();
    createRedSparks(player.x + player.w / 2, player.y + player.h / 2, 16);
  }

  function updateFeedback(dt) {
    if (feedback.goodTimer > 0) feedback.goodTimer -= dt;
    if (feedback.badTimer > 0) feedback.badTimer -= dt;
    if (feedback.goodBgFlash > 0) feedback.goodBgFlash -= dt;
    if (feedback.badBgFlash > 0) feedback.badBgFlash -= dt;
    if (feedback.badSkyPulse > 0) feedback.badSkyPulse -= dt;
    if (feedback.roverGlow > 0) feedback.roverGlow -= dt;
    if (feedback.roverShake > 0) feedback.roverShake -= dt;

    for (let i = feedback.particles.length - 1; i >= 0; i--) {
      const p = feedback.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.kind === 'redSpark' || p.kind === 'debris' ? 0.25 : 0.1) * dt;
      p.life -= dt;
      if (p.life <= 0) feedback.particles.splice(i, 1);
    }

    for (let i = feedback.burstStars.length - 1; i >= 0; i--) {
      const s = feedback.burstStars[i];
      s.life -= dt;
      if (s.life <= 0) feedback.burstStars.splice(i, 1);
    }

    for (let i = feedback.collectBursts.length - 1; i >= 0; i--) {
      feedback.collectBursts[i].timer -= dt;
      if (feedback.collectBursts[i].timer <= 0) feedback.collectBursts.splice(i, 1);
    }

    for (let i = feedback.scorePopups.length - 1; i >= 0; i--) {
      const popup = feedback.scorePopups[i];
      popup.y += popup.vy * dt;
      popup.vy *= Math.pow(0.99, dt);
      popup.life -= dt;
      if (popup.life <= 0) feedback.scorePopups.splice(i, 1);
    }

    for (let i = feedback.impactBursts.length - 1; i >= 0; i--) {
      feedback.impactBursts[i].timer -= dt;
      if (feedback.impactBursts[i].timer <= 0) feedback.impactBursts.splice(i, 1);
    }
  }

  function drawFeedbackBackground() {
    if (feedback.goodBgFlash > 0) {
      const t = feedback.goodBgFlash / GOOD_FEEDBACK_DURATION;
      ctx.fillStyle = `rgba(255, 245, 200, ${t * 0.32})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const s of feedback.burstStars) {
        const alpha = (s.life / s.maxLife) * t;
        const pulse = Math.sin(frameCount * 0.25 + s.twinkle) * 0.3 + 0.7;
        ctx.globalAlpha = alpha * pulse;
        ctx.fillStyle = '#fff8dc';
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
        if (s.size > 3) {
          ctx.fillStyle = '#ffd700';
          ctx.fillRect(Math.floor(s.x + 1), Math.floor(s.y + 1), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }

    if (feedback.badBgFlash > 0 || feedback.badSkyPulse > 0) {
      const base = Math.max(
        feedback.badBgFlash / BAD_SKY_FLASH_DURATION,
        feedback.badSkyPulse / BAD_SKY_FLASH_DURATION
      );
      const pulse = Math.sin(frameCount * 0.14) * 0.38 + 0.62;
      const t = base * pulse;
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, `rgba(90, 0, 25, ${t * 0.62})`);
      grad.addColorStop(0.45, `rgba(160, 15, 20, ${t * 0.52})`);
      grad.addColorStop(1, `rgba(200, 40, 25, ${t * 0.38})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `rgba(255, 80, 60, ${t * 0.12 * pulse})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawFeedbackParticles() {
    for (const p of feedback.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const half = p.size / 2;
      ctx.fillRect(p.x - half, p.y - half, p.size, p.size);
      if (p.kind === 'sparkle' && alpha > 0.5) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x, p.y - 1, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawImpactBursts() {
    for (const burst of feedback.impactBursts) {
      const t = 1 - burst.timer / burst.maxTimer;
      const alpha = 1 - t;
      ctx.globalAlpha = alpha;

      const flashR = 12 + t * 48;
      const flash = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, flashR);
      flash.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
      flash.addColorStop(0.25, 'rgba(255, 120, 40, 0.75)');
      flash.addColorStop(0.6, 'rgba(220, 50, 20, 0.35)');
      flash.addColorStop(1, 'rgba(180, 30, 10, 0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, flashR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 180, 80, ${alpha * 0.8})`;
      ctx.lineWidth = 3 - t * 2;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, 10 + t * 40, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }
  }

  function drawCollectBursts() {
    for (const burst of feedback.collectBursts) {
      const t = 1 - burst.timer / burst.maxTimer;
      const radius = 6 + t * 18;
      const alpha = 1 - t;
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + t * 2;
        const sx = burst.x + Math.cos(angle) * radius * 0.7;
        const sy = burst.y + Math.sin(angle) * radius * 0.7;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawScorePopups() {
    for (const popup of feedback.scorePopups) {
      const t = 1 - popup.life / popup.maxLife;
      const fadeStart = 0.45;
      const alpha = t < fadeStart ? 1 : 1 - (t - fadeStart) / (1 - fadeStart);
      const scale = t < 0.2 ? 0.75 + (t / 0.2) * 0.35 : 1.1 - t * 0.15;
      const text = `+${popup.points}`;

      ctx.save();
      ctx.translate(popup.x, popup.y);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 4;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = popup.color;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawRoverGlow(x, y) {
    if (feedback.roverGlow <= 0) return;
    const t = feedback.roverGlow / GOOD_FEEDBACK_DURATION;
    const cx = x + 16;
    const cy = y + 18;
    const radius = 28 + (1 - t) * 10;
    const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, radius);
    grad.addColorStop(0, `rgba(255, 230, 120, ${t * 0.55})`);
    grad.addColorStop(0.5, `rgba(255, 200, 60, ${t * 0.25})`);
    grad.addColorStop(1, 'rgba(255, 200, 60, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }

  function getRoverShakeOffset() {
    if (feedback.roverShake <= 0) return { x: 0, y: 0 };
    const t = feedback.roverShake;
    return {
      x: Math.sin(t * 1.7) * 5,
      y: Math.sin(t * 2.3) * 3,
    };
  }

  function showDamageMessage(message) {
    damageMessageEl.textContent = message;
    damageMessageEl.classList.remove('visible');
    void damageMessageEl.offsetWidth;
    damageMessageEl.classList.add('visible');
    damageMessageTimer = DAMAGE_MESSAGE_DURATION;
    feedback.badBgFlash = Math.max(feedback.badBgFlash, 20);
    feedback.roverShake = Math.max(feedback.roverShake, BAD_FEEDBACK_DURATION);
  }

  function updateDamageMessage(dt) {
    if (damageMessageTimer <= 0) return;
    damageMessageTimer -= dt;
    if (damageMessageTimer <= 0) {
      damageMessageEl.classList.remove('visible');
      damageMessageEl.textContent = '';
    }
  }

  function clearDamageMessage() {
    damageMessageTimer = 0;
    damageMessageEl.classList.remove('visible');
    damageMessageEl.textContent = '';
  }

  function handlePlayerDamage(reason) {
    if (state !== 'playing' || invincibleTimer > 0) return;

    if (reason === 'alien') GameAudio.play('alien');
    else if (reason === 'asteroid') GameAudio.play('asteroidHit');
    else if (reason === 'crater' || reason === 'fall') GameAudio.play('crater');

    showDamageMessage(DAMAGE_MESSAGES[reason]);
    triggerBadFeedback();
    lives--;
    updateHUD();
    invincibleTimer = INVINCIBLE_FRAMES;

    if (lives <= 0) {
      showGameOverScreen();
      return;
    }

    player.x = spawnX;
    player.y = FLOOR_Y - 24;
    player.vx = 0;
    player.vy = 0;
    cameraX = Math.max(0, Math.min(spawnX - canvas.width * CAMERA_LEAD, worldWidth - canvas.width));
  }

  function addScore(points) {
    score += points;
    updateHUD();
  }

  function showFinalScore(title, restartPrompt) {
    showOverlay(`
      <h1>${title}</h1>
      <p class="subtitle final-score">Final Score: ${score}</p>
      <p class="subtitle game-over-restart">${restartPrompt}</p>
    `);
  }

  function showGameOverScreen() {
    state = 'gameover';
    GameAudio.play('gameOver');
    showFinalScore('GAME OVER', 'Press Enter to Restart');
  }

  function showOverlay(html) {
    overlayContent.innerHTML = html;
    overlay.classList.add('visible');
  }

  function hideOverlay() {
    overlay.classList.remove('visible');
  }

  function getRequired() {
    return LEVELS[levelIndex].required;
  }

  function updateHUD() {
    const required = getRequired();
    document.getElementById('lives-display').textContent =
      '♥ '.repeat(lives).trim() || '—';
    document.getElementById('level-display').textContent = levelIndex + 1;
    document.getElementById('good-cells-count').textContent = collected.goodCells;
    document.getElementById('good-cells-goal').textContent = required.goodCells;
    document.getElementById('gems-count').textContent = collected.gems;
    document.getElementById('gems-goal').textContent = required.gems;
    document.getElementById('water-count').textContent = collected.water;
    document.getElementById('water-goal').textContent = required.water;
    document.getElementById('score-display').textContent = `Score: ${score}`;
  }

  function computeWorldWidth(level) {
    return level.width || canvas.width;
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    platforms = level.platforms.map(p => ({ ...p }));
    craters = level.craters.map((c) => ({ ...c }));
    aliens = level.aliens.map((a) => ({ ...a, dir: 1 }));
    mineralRocks = [];
    collectibles = level.collectibles.map((c, i) => ({
      ...c,
      y: c.y ?? COLLECT_FLOAT_Y,
      collected: false,
      hidden: !!c.inRock,
      bob: Math.random() * Math.PI * 2,
      index: i,
    }));
    collectibles.forEach((item, i) => {
      if (item.inRock) {
        const rockBase = item.rockY ?? FLOOR_Y;
        mineralRocks.push({
          x: item.x - 20,
          y: rockBase - 30,
          w: 40,
          h: 30,
          collectibleIndex: i,
          broken: false,
          shatter: 0,
        });
      }
    });
    asteroids = [];
    collected = { goodCells: 0, gems: 0, water: 0 };
    levelAdvanceTimer = 0;
    pickupCooldown = 75;
    worldWidth = computeWorldWidth(level);
    spawnX = level.spawnX ?? 50;
    cameraX = 0;
    player = { x: spawnX, y: FLOOR_Y - 24, w: 32, h: 24, vx: 0, vy: 0, onGround: false, facing: 1 };
    invincibleTimer = INVINCIBLE_FRAMES;
    asteroidTimer = 120;
    resetFeedback();
    clearDamageMessage();
    updateHUD();
  }

  function goalsMet() {
    const r = getRequired();
    const countsMet =
      collected.goodCells >= r.goodCells &&
      collected.gems >= r.gems &&
      collected.water >= r.water;
    if (!countsMet) return false;
    return collectibles.every((item) => item.collected);
  }

  function advanceToNextLevel() {
    levelIndex++;
    loadLevel(levelIndex);
    state = 'playing';
    hideOverlay();
    clearKeys();
    focusGame();
  }

  function levelComplete() {
    if (levelIndex >= LEVELS.length - 1) {
      state = 'victory';
      GameAudio.play('winning');
      showFinalScore('YOU SAVED EARTH!', 'Press Enter to Play Again');
      return;
    }

    state = 'levelcomplete';
    const next = LEVELS[levelIndex + 1];
    showOverlay(`
      <h1>Level Complete!</h1>
      <p class="subtitle">${LEVELS[levelIndex].name} cleared</p>
      <p class="story">Next: <strong>${next.name}</strong> (Level ${next.level})</p>
    `);
    levelAdvanceTimer = LEVEL_COMPLETE_DELAY;
  }

  function clearKeys() {
    keys.left = false;
    keys.right = false;
    keys.up = false;
  }

  function focusGame() {
    canvas.focus({ preventScroll: true });
  }

  function applyKey(e, down) {
    const k = e.key;
    let handled = false;
    if (k === 'ArrowLeft' || k === 'Left' || k === 'a' || k === 'A') {
      keys.left = down;
      handled = true;
    }
    if (k === 'ArrowRight' || k === 'Right' || k === 'd' || k === 'D') {
      keys.right = down;
      handled = true;
    }
    if (k === 'ArrowUp' || k === 'Up' || k === 'w' || k === 'W' || k === ' ') {
      keys.up = down;
      handled = true;
    }
    if (handled && state === 'playing') {
      GameAudio.unlock();
      e.preventDefault();
    }
  }

  function startGame() {
    lives = MAX_LIVES;
    levelIndex = DEV_START_LEVEL;
    score = 0;
    clearDamageMessage();
    clearKeys();
    GameAudio.unlock();
    loadLevel(DEV_START_LEVEL);
    state = 'playing';
    hideOverlay();
    focusGame();
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function isOverCrater(px, py, pw, ph) {
    const cx = px + pw / 2;
    const feet = py + ph;
    for (const c of craters) {
      if (cx > c.x + 8 && cx < c.x + c.w - 8 && feet >= c.y) {
        return true;
      }
    }
    return false;
  }

  function updatePlayer(dt) {
    if (keys.left) {
      player.vx = -MOVE_SPEED;
      player.facing = -1;
    } else if (keys.right) {
      player.vx = MOVE_SPEED;
      player.facing = 1;
    } else {
      player.vx *= Math.pow(0.7, dt);
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }

    if (keys.up && player.onGround) {
      player.vy = JUMP_FORCE;
      player.onGround = false;
    }

    const prevY = player.y;
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    if (player.x < 0) player.x = 0;
    if (player.x + player.w > worldWidth) player.x = worldWidth - player.w;

    player.onGround = false;

    for (const p of platforms) {
      const prevBottom = prevY + player.h;
      const prevTop = prevY;

      if (rectsOverlap(player, p)) {
        if (player.vy > 0 && prevBottom <= p.y + 4) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else if (player.vy < 0 && prevTop >= p.y + p.h - 4) {
          player.y = p.y + p.h;
          player.vy = 0;
        } else if (player.vx > 0) {
          player.x = p.x - player.w;
        } else if (player.vx < 0) {
          player.x = p.x + p.w;
        }
      }
    }

    for (const rock of mineralRocks) {
      if (rock.broken) continue;
      const prevBottom = prevY + player.h;

      if (rectsOverlap(player, rock)) {
        if (player.vy > 0 && prevBottom <= rock.y + 6) {
          player.y = rock.y - player.h;
          player.vy = 0;
          player.onGround = true;
          breakMineralRock(rock);
        } else if (player.vx > 0) {
          player.x = rock.x - player.w;
        } else if (player.vx < 0) {
          player.x = rock.x + rock.w;
        }
      }
    }

    if (isOverCrater(player.x, player.y, player.w, player.h)) {
      handlePlayerDamage('crater');
    }

    if (player.y > canvas.height) {
      handlePlayerDamage('crater');
    }

    updateCamera(dt);
  }

  function updateCamera(dt) {
    const maxCamera = Math.max(0, worldWidth - canvas.width);
    const target = player.x - canvas.width * CAMERA_LEAD;
    const desired = Math.max(0, Math.min(target, maxCamera));
    const smooth = 1 - Math.pow(1 - CAMERA_SMOOTH, dt);
    cameraX += (desired - cameraX) * smooth;
    if (Math.abs(desired - cameraX) < 0.5) cameraX = desired;
  }

  function updateAliens(dt) {
    for (const alien of aliens) {
      alien.x += alien.speed * alien.dir * dt;
      if (alien.x <= alien.minX) { alien.x = alien.minX; alien.dir = 1; }
      if (alien.x + 28 >= alien.maxX) { alien.x = alien.maxX - 28; alien.dir = -1; }

      if (rectsOverlap(player, { x: alien.x, y: alien.y, w: 28, h: 32 })) {
        handlePlayerDamage('alien');
      }
    }
  }

  const ASTEROID_SRC_W = 674;
  const ASTEROID_SRC_H = 1025;
  /** Source rows above this are the narrow ray only; below is the full rock + flames. */
  const ASTEROID_BEAM_SRC_H = 300;
  /** Beam width in source px at the row closest to the rock (y ≈ beamSrcH − 1). */
  const ASTEROID_BEAM_JUNCTION_SRC_W = 218;
  const ASTEROID_ROCK_DRAW_H = 74;

  function asteroidRockDrawW() {
    const rockSrcH = ASTEROID_SRC_H - ASTEROID_BEAM_SRC_H;
    return ASTEROID_ROCK_DRAW_H * (ASTEROID_SRC_W / rockSrcH);
  }

  function asteroidBeamDrawW() {
    const rockSrcH = ASTEROID_SRC_H - ASTEROID_BEAM_SRC_H;
    return ASTEROID_BEAM_JUNCTION_SRC_W * (ASTEROID_ROCK_DRAW_H / rockSrcH);
  }

  function asteroidDrawW(a) {
    return Math.max(asteroidBeamDrawW(), asteroidRockDrawW());
  }

  function spawnAsteroid(level) {
    const beamH = 520 + Math.random() * 120;
    const beamW = asteroidDrawW({ beamH });
    const margin = 60;
    let x = cameraX + margin + Math.random() * (canvas.width - margin * 2);
    const playerCenter = player.x + player.w / 2;
    for (let attempt = 0; attempt < 6; attempt++) {
      if (Math.abs(x - playerCenter) > 130) break;
      x = cameraX + margin + Math.random() * (canvas.width - margin * 2);
    }
    asteroids.push({
      x,
      y: -beamH - 40,
      beamH,
      beamW,
      vy: level.asteroidSpeed ?? (3.5 + levelIndex * 0.35),
      phase: 'falling',
      explodeTimer: 0,
      explodeMax: 32,
      sfxPlayed: false,
    });
  }

  function asteroidHitbox(a) {
    const bottom = a.y + a.beamH;
    const impactH = 32;
    const w = asteroidRockDrawW();
    return {
      x: a.x - w * 0.42,
      y: bottom - impactH,
      w: w * 0.84,
      h: impactH + 8,
    };
  }

  function updateAsteroids(dt) {
    const level = LEVELS[levelIndex];
    if (!level.asteroids) return;

    const maxOnScreen = level.maxAsteroids ?? 1;
    if (asteroids.length < maxOnScreen) {
      asteroidTimer += dt;
      if (asteroidTimer >= (level.asteroidRate || 120)) {
        asteroidTimer = 0;
        spawnAsteroid(level);
      }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];

      if (a.phase === 'explode') {
        a.explodeTimer += dt;
        if (a.explodeTimer >= a.explodeMax) {
          asteroids.splice(i, 1);
        }
        continue;
      }

      a.y += a.vy * dt;
      const bottom = a.y + a.beamH;

      if (bottom >= FLOOR_Y - 8) {
        if (!a.sfxPlayed) {
          a.sfxPlayed = true;
          GameAudio.play('asteroid');
        }
        if (rectsOverlap(player, asteroidHitbox(a))) {
          handlePlayerDamage('asteroid');
        }
        triggerAsteroidExplosion(a);
        continue;
      }

      if (bottom >= player.y + 8 && rectsOverlap(player, asteroidHitbox(a))) {
        handlePlayerDamage('asteroid');
        triggerAsteroidExplosion(a);
        continue;
      }

      if (a.y > canvas.height + 80) {
        asteroids.splice(i, 1);
      }
    }
  }

  function breakMineralRock(rock) {
    if (rock.broken) return;
    rock.broken = true;
    rock.shatter = 16;
    const item = collectibles[rock.collectibleIndex];
    if (item) {
      item.hidden = false;
      item.x = rock.x + rock.w / 2;
      item.y = rock.y < FLOOR_Y - 20 ? rock.y - 16 : COLLECT_FLOAT_Y;
      item.bob = 0;
    }
  }

  function updateMineralRocks(dt) {
    for (const rock of mineralRocks) {
      if (rock.shatter > 0) rock.shatter -= dt;
    }
  }

  function updateCollectibles(dt) {
    if (pickupCooldown > 0) pickupCooldown -= dt;
    for (const item of collectibles) {
      if (item.collected || item.hidden || pickupCooldown > 0) continue;
      item.bob += 0.08 * dt;
      const hitbox = { x: item.x - 8, y: item.y - 8 + Math.sin(item.bob) * 3, w: 16, h: 16 };
      if (rectsOverlap(player, hitbox)) {
        item.collected = true;
        triggerGoodFeedback(item.x, item.y + Math.sin(item.bob) * 4);
        if (item.type === 'microbe') GameAudio.play('cell');
        else if (item.type === 'mineral') GameAudio.play('gem');
        else GameAudio.play('water');
        collected[item.type === 'mineral' ? 'gems' : item.type === 'microbe' ? 'goodCells' : 'water']++;
        addScore(POINTS_PER_COLLECTIBLE);
        spawnScorePopup(item.x, item.y + Math.sin(item.bob) * 4, POINTS_PER_COLLECTIBLE, item.type);
        if (goalsMet()) {
          levelComplete();
        }
      }
    }
  }

  const BG = {
    skyTop: '#2a0e42',
    skyMid: '#6a2860',
    skyHorizon: '#c86038',
    skyGlow: '#e87840',
    starWhite: '#f8f4ff',
    starWarm: '#ffe8a0',
    groundTop: '#d07050',
    groundMid: '#b05838',
    groundDark: '#8a4030',
    groundUnder: '#4a2018',
  };

  let skyStarsCache = null;

  function bgHash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function getSkyStars() {
    if (!skyStarsCache) {
      skyStarsCache = [];
      for (let i = 0; i < 110; i++) {
        skyStarsCache.push({
          wx: i * 83 + 17,
          y: 8 + Math.floor(bgHash(i * 3.1) * 290),
          size: bgHash(i * 7.3) > 0.92 ? 3 : bgHash(i * 5.1) > 0.75 ? 2 : 1,
          warm: bgHash(i * 11.2) > 0.82,
          twinkle: bgHash(i * 2.7) * Math.PI * 2,
        });
      }
    }
    return skyStarsCache;
  }

  function withSmoothSkyDraw(fn) {
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    fn();
    ctx.imageSmoothingEnabled = prev;
  }

  function drawSkyGradient() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, BG.skyTop);
    g.addColorStop(0.32, '#4a1850');
    g.addColorStop(0.55, BG.skyMid);
    g.addColorStop(0.78, '#a84040');
    g.addColorStop(0.92, BG.skyHorizon);
    g.addColorStop(1, BG.skyGlow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawNebulaBands() {
    const drift = cameraX * 0.04;
    const bands = [
      { y0: 70, amp: 38, color: 'rgba(170, 80, 155, 0.16)', phase: 0 },
      { y0: 130, amp: 52, color: 'rgba(210, 110, 145, 0.13)', phase: 1.4 },
      { y0: 195, amp: 32, color: 'rgba(255, 140, 120, 0.1)', phase: 2.8 },
    ];

    for (const band of bands) {
      ctx.fillStyle = band.color;
      ctx.beginPath();
      for (let x = -40; x <= canvas.width + 40; x += 3) {
        const wx = x + drift;
        const y = band.y0
          + Math.sin(wx * 0.007 + band.phase) * band.amp
          + Math.sin(wx * 0.017 + band.phase * 2) * band.amp * 0.35;
        if (x === -40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(canvas.width + 40, canvas.height * 0.72);
      ctx.lineTo(-40, canvas.height * 0.72);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBackgroundPlanet() {
    const cx = 500 - cameraX * 0.028;
    const cy = 150;
    const r = 138;

    const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r + 30);
    glow.addColorStop(0, 'rgba(100, 50, 120, 0.35)');
    glow.addColorStop(1, 'rgba(50, 20, 70, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 30, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(cx - 28, cy - 36, r * 0.15, cx, cy, r);
    body.addColorStop(0, 'rgba(130, 65, 150, 0.5)');
    body.addColorStop(0.65, 'rgba(75, 32, 95, 0.42)');
    body.addColorStop(1, 'rgba(45, 18, 62, 0)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(32, 10, 48, 0.32)';
    const craters = [
      [cx - 38, cy - 18, 26],
      [cx + 28, cy + 12, 20],
      [cx - 8, cy + 42, 16],
      [cx + 52, cy - 32, 14],
      [cx - 55, cy + 20, 12],
    ];
    for (const [px, py, pr] of craters) {
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSkyMoon() {
    const mx = canvas.width - 68 - cameraX * 0.032;
    const my = 46;
    const r = 26;

    const halo = ctx.createRadialGradient(mx, my, r * 0.4, mx, my, r + 14);
    halo.addColorStop(0, 'rgba(255, 215, 175, 0.18)');
    halo.addColorStop(1, 'rgba(255, 215, 175, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, r + 14, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(mx - 7, my - 9, 3, mx, my, r);
    body.addColorStop(0, '#d8a898');
    body.addColorStop(1, '#8e6860');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(62, 36, 34, 0.7)';
    const moonCraters = [
      [mx - 7, my - 4, 7],
      [mx + 9, my + 7, 5],
      [mx + 1, my - 11, 4],
      [mx - 11, my + 9, 4],
      [mx + 5, my - 2, 3],
    ];
    for (const [px, py, pr] of moonCraters) {
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSkyStars() {
    const drift = cameraX * 0.018;
    const wrap = canvas.width + 40;

    for (const s of getSkyStars()) {
      let sx = (s.wx - drift) % wrap;
      if (sx < -10) sx += wrap;

      if (s.warm) {
        const pulse = Math.sin(frameCount * 0.04 + s.twinkle) * 0.25 + 0.75;
        const gr = ctx.createRadialGradient(sx, s.y, 0, sx, s.y, 7);
        gr.addColorStop(0, `rgba(255, 228, 150, ${0.75 * pulse})`);
        gr.addColorStop(0.45, `rgba(255, 195, 95, ${0.22 * pulse})`);
        gr.addColorStop(1, 'rgba(255, 195, 95, 0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(sx, s.y, 7, 0, Math.PI * 2);
        ctx.fill();

        if (s.size >= 3) {
          ctx.strokeStyle = `rgba(255, 238, 185, ${0.32 * pulse})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx - 9, s.y);
          ctx.lineTo(sx + 9, s.y);
          ctx.moveTo(sx, s.y - 9);
          ctx.lineTo(sx, s.y + 9);
          ctx.stroke();
        }
      }

      ctx.fillStyle = s.warm ? BG.starWarm : BG.starWhite;
      const half = Math.floor(s.size / 2);
      ctx.fillRect(Math.floor(sx - half), Math.floor(s.y - half), s.size, s.size);
    }
  }

  function drawHorizonHaze() {
    const horizonY = FLOOR_Y - 18;
    const h = ctx.createLinearGradient(0, horizonY - 90, 0, horizonY + 8);
    h.addColorStop(0, 'rgba(220, 100, 60, 0)');
    h.addColorStop(0.45, 'rgba(240, 120, 70, 0.18)');
    h.addColorStop(1, 'rgba(170, 65, 38, 0.32)');
    ctx.fillStyle = h;
    ctx.fillRect(0, horizonY - 90, canvas.width, 98);
  }

  function drawBackground() {
    withSmoothSkyDraw(() => {
      if (!GameAssets.drawLevelBackground(ctx, canvas.width, canvas.height)) {
        drawSkyGradient();
        drawNebulaBands();
        drawBackgroundPlanet();
        drawSkyMoon();
        drawSkyStars();
        drawHorizonHaze();
      }
    });
  }

  const GROUND_DRAW_H = 76;
  /** Source art size for mars-crater.png (walk surface lip row from top). */
  const CRATER_SRC_W = 1025;
  const CRATER_SRC_H = 290;
  const CRATER_SURFACE_LIP_SRC = 9;

  function isOnScreen(worldX, width) {
    return worldX + width > cameraX && worldX < cameraX + canvas.width;
  }

  function drawSandyFloor(p) {
    ctx.fillStyle = BG.groundUnder;
    ctx.fillRect(p.x, p.y + p.h - 8, p.w, 8);

    ctx.fillStyle = BG.groundMid;
    ctx.fillRect(p.x, p.y + 4, p.w, p.h - 12);

    ctx.fillStyle = BG.groundDark;
    for (let px = p.x + 4; px < p.x + p.w - 4; px += 16) {
      if (bgHash(px * 0.07) > 0.55) {
        ctx.fillRect(px, p.y + 10, 4, 2);
        ctx.fillRect(px + 6, p.y + 20, 3, 2);
      }
    }

    ctx.fillStyle = BG.groundTop;
    ctx.fillRect(p.x, p.y, p.w, 4);

    for (let px = p.x; px < p.x + p.w; px += 8) {
      if (bgHash(px * 0.13 + 2) > 0.7) {
        ctx.fillStyle = '#e08868';
        ctx.fillRect(px, p.y + 1, 2, 1);
      }
    }
  }

  function drawMarsGround(x, y, width) {
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (!GameAssets.drawStretchedHorizontal(ctx, 'marsGround', x, y, width, GROUND_DRAW_H)) {
      drawSandyFloor({ x, y, w: width, h: 40 });
    }
    ctx.imageSmoothingEnabled = prev;
  }

  function drawPlatforms() {
    const groundPlatforms = platforms.filter((p) => p.y >= 400);
    for (const p of groundPlatforms) {
      drawMarsGround(Math.floor(p.x), FLOOR_Y, Math.ceil(p.w));
    }
    for (const p of platforms) {
      if (p.y < 400) drawSandyFloor(p);
    }
  }

  function drawCraters() {
    for (const c of craters) {
      if (!isOnScreen(c.x - 50, c.w + 100)) continue;
      drawMarsCrater(c);
    }
  }

  function drawMarsCrater(c) {
    const drawH = GROUND_DRAW_H;
    const cx = c.x + c.w / 2;
    const lipOffset = CRATER_SURFACE_LIP_SRC * (drawH / CRATER_SRC_H);
    const top = c.y - lipOffset;
    const drawW = Math.max(c.w + 48, drawH * (CRATER_SRC_W / CRATER_SRC_H));
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    const drewSprite = GameAssets.drawSpriteTop(ctx, 'marsCrater', cx, top, drawW, drawH);
    if (!drewSprite) {
      drawStylizedCrater(c);
    } else {
      // Ensure the gameplay pit reads as a hole (opaque black), not ground showing through.
      const pitCx = c.x + c.w / 2;
      const pitTop = c.y - 2;
      const pitRx = c.w * 0.46;
      const pitRy = 18;
      ctx.fillStyle = '#040203';
      ctx.beginPath();
      ctx.ellipse(pitCx, pitTop + pitRy * 0.55, pitRx, pitRy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.imageSmoothingEnabled = prev;
  }

  function drawStylizedCrater(c) {
    const left = c.x;
    const right = c.x + c.w;
    const floorY = c.y;
    const midX = (left + right) / 2;
    const depth = 52;
    const pitBottom = floorY + depth;
    const seed = Math.floor(midX * 0.17);

    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;

    function wallX(side, step, total) {
      const t = step / total;
      const jag = (bgHash(seed + step * 2.1 + (side === 'left' ? 0 : 50)) - 0.5) * 10;
      const shelf = Math.floor(step / 2) % 2 === 0 ? 4 : -2;
      if (side === 'left') {
        return left + 2 + t * c.w * 0.38 + jag + shelf;
      }
      return right - 2 - t * c.w * 0.38 + jag - shelf;
    }

    const steps = 10;

    ctx.fillStyle = '#0a0302';
    ctx.beginPath();
    ctx.moveTo(left, floorY);
    for (let i = 0; i <= steps; i++) {
      ctx.lineTo(wallX('left', i, steps), floorY + depth * (i / steps));
    }
    ctx.lineTo(midX, pitBottom + 4);
    for (let i = steps; i >= 0; i--) {
      ctx.lineTo(wallX('right', i, steps), floorY + depth * (i / steps));
    }
    ctx.lineTo(right, floorY);
    ctx.closePath();
    ctx.fill();

    const wallColors = ['#a86048', '#8e5040', '#784038', '#603028', '#482018'];
    for (let i = 0; i < steps; i++) {
      const y0 = floorY + depth * (i / steps);
      const y1 = floorY + depth * ((i + 1) / steps);
      ctx.fillStyle = wallColors[i % wallColors.length];
      ctx.beginPath();
      ctx.moveTo(left - 1, y0);
      ctx.lineTo(wallX('left', i, steps), y0);
      ctx.lineTo(wallX('left', i + 1, steps), y1);
      ctx.lineTo(left - 1, y1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(right + 1, y0);
      ctx.lineTo(wallX('right', i, steps), y0);
      ctx.lineTo(wallX('right', i + 1, steps), y1);
      ctx.lineTo(right + 1, y1);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = BG.groundTop;
    ctx.fillRect(left - 5, floorY - 4, 12, 5);
    ctx.fillRect(right - 8, floorY - 5, 12, 5);

    ctx.imageSmoothingEnabled = prevSmooth;
  }

  function drawRover(x, y, facing, flash) {
    if (flash) return;

    if (GameAssets.hasSprite('rover')) {
      const drawH = 50;
      const prevSmooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.save();
      ctx.translate(x + 16, y + 24);
      ctx.scale(facing, 1);
      GameAssets.drawSpriteAspect(ctx, 'rover', 0, -drawH / 2, drawH);
      ctx.restore();
      ctx.imageSmoothingEnabled = prevSmooth;
      return;
    }

    ctx.save();
    ctx.translate(x + 16, y + 12);
    ctx.scale(facing, 1);
    ctx.translate(-16, -12);

    ctx.fillStyle = COLORS.rover;
    ctx.fillRect(4, 4, 24, 14);
    ctx.fillStyle = '#888';
    ctx.fillRect(8, 0, 16, 8);
    ctx.fillStyle = '#66ccff';
    ctx.fillRect(10, 2, 12, 5);

    ctx.fillStyle = COLORS.roverWheel;
    ctx.fillRect(2, 16, 10, 8);
    ctx.fillRect(20, 16, 10, 8);
    ctx.fillStyle = '#555';
    ctx.fillRect(4, 18, 6, 4);
    ctx.fillRect(22, 18, 6, 4);

    ctx.fillStyle = COLORS.roverAntenna;
    ctx.fillRect(14, -6, 2, 8);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(13, -8, 4, 3);

    ctx.restore();
  }

  function drawAlien(alien) {
    const cx = alien.x + 14;
    const feetY = FLOOR_Y - 2;
    const drawH = 48;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if (GameAssets.hasSprite('evilAlien')) {
      GameAssets.drawSpriteAspect(ctx, 'evilAlien', cx, feetY - drawH / 2, drawH);
    }
    ctx.imageSmoothingEnabled = prev;
  }

  function drawMineralRock(rock) {
    if (rock.broken && rock.shatter <= 0) return;

    if (rock.shatter > 0) {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + rock.shatter * 0.2;
        const dist = (16 - rock.shatter) * 2.5;
        ctx.fillStyle = i % 2 ? COLORS.rockMid : COLORS.rockDark;
        const sx = rock.x + rock.w / 2 + Math.cos(angle) * dist;
        const sy = rock.y + rock.h / 2 + Math.sin(angle) * dist * 0.6;
        ctx.fillRect(sx - 3, sy - 3, 6, 5);
      }
      return;
    }

    const { x, y, w, h } = rock;
    ctx.fillStyle = COLORS.rockDark;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + h);
    ctx.lineTo(x + w * 0.15, y + 8);
    ctx.lineTo(x + w * 0.5, y + 2);
    ctx.lineTo(x + w * 0.82, y + 10);
    ctx.lineTo(x + w - 3, y + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.rockMid;
    ctx.fillRect(x + 5, y + 12, w - 10, h - 14);
    ctx.fillStyle = COLORS.rockLight;
    ctx.fillRect(x + 7, y + 10, w * 0.3, 5);

    const item = collectibles[rock.collectibleIndex];
    if (item && !item.collected) {
      const mx = x + w / 2;
      const my = y + h / 2 + 2;
      GameAssets.drawSprite(ctx, 'gem', mx, my, 24, 24);
    }
  }

  function drawCollectibleShadow(x) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, FLOOR_Y + 3, 11, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCollectible(item) {
    if (item.collected || item.hidden) return;
    const bobY = Math.sin(item.bob) * 4;
    const x = item.x;
    const y = item.y + bobY;

    drawCollectibleShadow(x);

    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;

    if (item.type === 'mineral') {
      GameAssets.drawSprite(ctx, 'gem', x, y, 32, 32);
    } else if (item.type === 'microbe') {
      GameAssets.drawSprite(ctx, 'goodCell', x, y, 36, 36);
    } else {
      GameAssets.drawSprite(ctx, 'water', x, y, 28, 32);
    }

    ctx.imageSmoothingEnabled = prev;
  }

  function drawAsteroidBeamProcedural(cx, top, w, h) {
    const bottom = top + h;
    const pulse = Math.sin(frameCount * 0.14 + cx * 0.02);
    const flicker = Math.sin(frameCount * 0.28 + cx * 0.03) * 0.5 + 0.5;

    ctx.save();

    // Wide outer aura
    const auraW = w * (1.35 + pulse * 0.08);
    const auraGrad = ctx.createLinearGradient(cx, top, cx, bottom);
    auraGrad.addColorStop(0, 'rgba(255, 90, 30, 0)');
    auraGrad.addColorStop(0.2, `rgba(255, 70, 20, ${0.08 + flicker * 0.06})`);
    auraGrad.addColorStop(0.55, `rgba(255, 45, 15, ${0.22 + flicker * 0.1})`);
    auraGrad.addColorStop(1, 'rgba(255, 80, 25, 0.45)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.moveTo(cx - auraW * 0.12, top);
    ctx.lineTo(cx + auraW * 0.12, top);
    ctx.lineTo(cx + auraW * 0.55, bottom);
    ctx.lineTo(cx - auraW * 0.55, bottom);
    ctx.closePath();
    ctx.fill();

    // Mid flame body — soft tapered cone
    const midW = w * (0.72 + pulse * 0.06);
    const flameGrad = ctx.createLinearGradient(cx - midW, top, cx + midW, bottom);
    flameGrad.addColorStop(0, 'rgba(255, 200, 80, 0.15)');
    flameGrad.addColorStop(0.25, 'rgba(255, 120, 40, 0.55)');
    flameGrad.addColorStop(0.65, 'rgba(255, 60, 20, 0.75)');
    flameGrad.addColorStop(1, 'rgba(255, 100, 35, 0.9)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(cx - midW * 0.2, top);
    ctx.lineTo(cx + midW * 0.2, top);
    ctx.lineTo(cx + midW * 0.48, bottom);
    ctx.lineTo(cx - midW * 0.48, bottom);
    ctx.closePath();
    ctx.fill();

    // Animated side wisps
    for (let i = 0; i < 3; i++) {
      const phase = frameCount * 0.18 + i * 2.1 + cx * 0.015;
      const side = i % 2 === 0 ? -1 : 1;
      const wx = cx + side * w * (0.22 + Math.sin(phase) * 0.06);
      const wy = top + h * (0.25 + i * 0.22);
      const wispR = w * (0.18 + Math.sin(phase * 1.3) * 0.05);
      const wisp = ctx.createRadialGradient(wx, wy, 0, wx, wy, wispR);
      wisp.addColorStop(0, `rgba(255, 180, 60, ${0.35 + flicker * 0.2})`);
      wisp.addColorStop(0.5, 'rgba(255, 80, 25, 0.2)');
      wisp.addColorStop(1, 'rgba(255, 40, 10, 0)');
      ctx.fillStyle = wisp;
      ctx.beginPath();
      ctx.ellipse(wx, wy, wispR * 0.55, wispR, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hot inner core
    const coreW = w * (0.22 + pulse * 0.04);
    const coreGrad = ctx.createLinearGradient(cx, top, cx, bottom);
    coreGrad.addColorStop(0, 'rgba(255, 255, 220, 0.5)');
    coreGrad.addColorStop(0.35, 'rgba(255, 240, 120, 0.85)');
    coreGrad.addColorStop(0.75, 'rgba(255, 180, 60, 0.9)');
    coreGrad.addColorStop(1, 'rgba(255, 120, 40, 1)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(cx - coreW * 0.15, top);
    ctx.lineTo(cx + coreW * 0.15, top);
    ctx.lineTo(cx + coreW * 0.35, bottom);
    ctx.lineTo(cx - coreW * 0.35, bottom);
    ctx.closePath();
    ctx.fill();

    // Bright center streak
    const streakGrad = ctx.createLinearGradient(cx, top, cx, bottom);
    streakGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    streakGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.95)');
    streakGrad.addColorStop(1, 'rgba(255, 220, 140, 1)');
    ctx.fillStyle = streakGrad;
    ctx.fillRect(cx - w * 0.04, top, w * 0.08, h);

    // Ground impact bloom
    const bloomR = w * (0.95 + pulse * 0.12);
    const bloom = ctx.createRadialGradient(cx, bottom, 0, cx, bottom, bloomR);
    bloom.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    bloom.addColorStop(0.15, 'rgba(255, 200, 80, 0.85)');
    bloom.addColorStop(0.4, 'rgba(255, 90, 30, 0.55)');
    bloom.addColorStop(0.7, 'rgba(255, 40, 15, 0.2)');
    bloom.addColorStop(1, 'rgba(255, 30, 10, 0)');
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.ellipse(cx, bottom, bloomR * 0.62, bloomR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Scorch ring
    ctx.strokeStyle = `rgba(255, 140, 50, ${0.35 + flicker * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, bottom, bloomR * 0.45, bloomR * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawAsteroid(a) {
    if (a.phase === 'explode') {
      return;
    }

    const cx = a.x;
    const top = a.y;
    const h = a.beamH;

    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    if (!GameAssets.drawAsteroidComposite(
      ctx, 'asteroid', cx, top, h, ASTEROID_ROCK_DRAW_H,
      ASTEROID_BEAM_SRC_H, ASTEROID_BEAM_JUNCTION_SRC_W, asteroidBeamDrawW()
    )) {
      drawAsteroidBeamProcedural(cx, top, asteroidBeamDrawW(), h - ASTEROID_ROCK_DRAW_H);
    }
    ctx.imageSmoothingEnabled = prev;
  }

  function render() {
    drawBackground();
    drawFeedbackBackground();

    ctx.save();
    ctx.translate(-Math.floor(cameraX), 0);

    drawPlatforms();
    drawCraters();

    for (const rock of mineralRocks) {
      if (isOnScreen(rock.x, rock.w)) drawMineralRock(rock);
    }

    for (const item of collectibles) {
      if (isOnScreen(item.x - 16, 32)) drawCollectible(item);
    }
    for (const alien of aliens) {
      if (isOnScreen(alien.x, 28)) drawAlien(alien);
    }
    for (const a of asteroids) {
      if (isOnScreen(a.x - asteroidDrawW(a), asteroidDrawW(a) * 2)) drawAsteroid(a);
    }

    drawImpactBursts();
    drawCollectBursts();
    drawScorePopups();
    drawFeedbackParticles();

    const shake = getRoverShakeOffset();
    const roverX = player.x + shake.x;
    const roverY = player.y + shake.y;
    drawRoverGlow(roverX, roverY);

    const invincibleBlink = invincibleTimer > 0 && Math.floor(invincibleTimer / 6) % 2 === 0;
    const damageBlink = feedback.badTimer > 0 && Math.floor(feedback.badTimer / 3) % 2 === 0;
    drawRover(roverX, roverY, player.facing, invincibleBlink || damageBlink);

    ctx.restore();
  }

  function update(dt) {
    if (state === 'levelcomplete') {
      updateFeedback(dt);
      if (levelAdvanceTimer > 0) {
        levelAdvanceTimer -= dt;
        if (levelAdvanceTimer <= 0) {
          advanceToNextLevel();
        }
      }
      frameCount += dt;
      return;
    }

    if (state !== 'playing') return;

    updatePlayer(dt);
    updateAliens(dt);
    updateAsteroids(dt);
    updateMineralRocks(dt);
    updateCollectibles(dt);
    updateFeedback(dt);

    if (invincibleTimer > 0) invincibleTimer -= dt;
    frameCount += dt;
  }

  function gameLoop(now) {
    if (gameLoop.lastTime === undefined) {
      gameLoop.lastTime = now;
    }
    const elapsed = Math.min(now - gameLoop.lastTime, 100);
    gameLoop.lastTime = now;
    const dt = elapsed / TARGET_FRAME_MS;

    updateDamageMessage(dt);
    if (state !== 'playing') {
      updateFeedback(dt);
    }
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (state === 'gameover' || state === 'victory')) {
      startGame();
      return;
    }
    applyKey(e, true);
  });

  document.addEventListener('keyup', (e) => {
    applyKey(e, false);
  });

  window.addEventListener('blur', clearKeys);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearKeys();
  });

  canvas.addEventListener('click', focusGame);
  document.getElementById('game-container').addEventListener('click', focusGame);

  function initGameEngine() {
    if (initGameEngine.started) return;
    initGameEngine.started = true;
    GameAudio.unlock();
    GameAssets.loadAll()
      .then(() => {
        gameLoop();
        startGame();
      })
      .catch(() => {
        gameLoop();
        startGame();
      });
  }

  if (document.getElementById('game-container').hidden) {
    document.addEventListener('ark3:start-game', initGameEngine, { once: true });
  } else {
    initGameEngine();
  }
})();
