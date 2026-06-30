(function () {
  'use strict';

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const overlayContent = document.getElementById('overlay-content');
  const startBtn = document.getElementById('start-btn');

  const GRAVITY = 0.55;
  const JUMP_FORCE = -11;
  const MOVE_SPEED = 4;
  const MAX_LIVES = 3;
  const INVINCIBLE_FRAMES = 90;

  const COLORS = {
    sky: '#6b1f0a',
    skyGradient: '#3d0f05',
    ground: '#8b4513',
    groundTop: '#a0522d',
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
  let collected = { minerals: 0, microbes: 0, water: 0 };
  let invincibleTimer = 0;
  let frameCount = 0;
  let asteroidTimer = 0;

  const keys = { left: false, right: false, up: false };

  let player = { x: 50, y: 400, w: 32, h: 24, vx: 0, vy: 0, onGround: false, facing: 1 };
  let platforms = [];
  let craters = [];
  let aliens = [];
  let collectibles = [];
  let asteroids = [];

  function showOverlay(html) {
    overlayContent.innerHTML = html;
    overlay.classList.add('visible');
  }

  function hideOverlay() {
    overlay.classList.remove('visible');
  }

  function updateHUD() {
    const level = LEVELS[levelIndex];
    document.getElementById('lives-display').textContent =
      '♥ '.repeat(lives).trim() || '—';
    document.getElementById('level-display').textContent = levelIndex + 1;
    document.getElementById('minerals-count').textContent = collected.minerals;
    document.getElementById('minerals-goal').textContent = level.goals.minerals;
    document.getElementById('microbes-count').textContent = collected.microbes;
    document.getElementById('microbes-goal').textContent = level.goals.microbes;
    document.getElementById('water-count').textContent = collected.water;
    document.getElementById('water-goal').textContent = level.goals.water;
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    platforms = level.platforms.map(p => ({ ...p }));
    craters = level.craters.map(c => ({ ...c }));
    aliens = level.aliens.map(a => ({ ...a, dir: 1 }));
    collectibles = level.collectibles.map(c => ({ ...c, collected: false, bob: Math.random() * Math.PI * 2 }));
    asteroids = [];
    collected = { minerals: 0, microbes: 0, water: 0 };
    player = { x: 50, y: 400, w: 32, h: 24, vx: 0, vy: 0, onGround: false, facing: 1 };
    invincibleTimer = INVINCIBLE_FRAMES;
    asteroidTimer = 0;
    updateHUD();
  }

  function goalsMet() {
    const g = LEVELS[levelIndex].goals;
    return collected.minerals >= g.minerals &&
           collected.microbes >= g.microbes &&
           collected.water >= g.water;
  }

  function loseLife() {
    lives--;
    updateHUD();
    if (lives <= 0) {
      gameOver();
    } else {
      invincibleTimer = INVINCIBLE_FRAMES;
      player.x = 50;
      player.y = 400;
      player.vx = 0;
      player.vy = 0;
    }
  }

  function gameOver() {
    state = 'gameover';
    showOverlay(`
      <h1>GAME OVER</h1>
      <p class="subtitle">The mission has failed.</p>
      <p class="story">Earth's hope fades as the rover is lost on Mars...</p>
      <button id="restart-btn" class="game-btn">TRY AGAIN</button>
    `);
    document.getElementById('restart-btn').addEventListener('click', startGame);
  }

  function levelComplete() {
    if (levelIndex >= LEVELS.length - 1) {
      state = 'victory';
      showOverlay(`
        <h1>MISSION COMPLETE!</h1>
        <p class="subtitle">You saved the Earth!</p>
        <p class="story">
          With minerals, microbes, and water secured, humanity has what it needs
          to survive. The Mars rover returns home a hero.
        </p>
        <button id="restart-btn" class="game-btn">PLAY AGAIN</button>
      `);
      document.getElementById('restart-btn').addEventListener('click', startGame);
    } else {
      state = 'levelcomplete';
      const next = LEVELS[levelIndex + 1];
      showOverlay(`
        <h1>LEVEL CLEAR!</h1>
        <p class="subtitle">${LEVELS[levelIndex].name} complete</p>
        <p class="story">Next: <strong>${next.name}</strong></p>
        <button id="next-btn" class="game-btn">CONTINUE</button>
      `);
      document.getElementById('next-btn').addEventListener('click', () => {
        levelIndex++;
        loadLevel(levelIndex);
        state = 'playing';
        hideOverlay();
      });
    }
  }

  function startGame() {
    lives = MAX_LIVES;
    levelIndex = 0;
    loadLevel(0);
    state = 'playing';
    hideOverlay();
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

  function updatePlayer() {
    if (keys.left) {
      player.vx = -MOVE_SPEED;
      player.facing = -1;
    } else if (keys.right) {
      player.vx = MOVE_SPEED;
      player.facing = 1;
    } else {
      player.vx *= 0.7;
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }

    if (keys.up && player.onGround) {
      player.vy = JUMP_FORCE;
      player.onGround = false;
    }

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    if (player.x < 0) player.x = 0;
    if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;

    player.onGround = false;

    for (const p of platforms) {
      const prevBottom = player.y + player.h - player.vy;
      const prevTop = player.y - player.vy;

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

    if (isOverCrater(player.x, player.y, player.w, player.h) && invincibleTimer <= 0) {
      loseLife();
    }

    if (player.y > canvas.height && invincibleTimer <= 0) {
      loseLife();
    }
  }

  function updateAliens() {
    for (const alien of aliens) {
      alien.x += alien.speed * alien.dir;
      if (alien.x <= alien.minX) { alien.x = alien.minX; alien.dir = 1; }
      if (alien.x + 28 >= alien.maxX) { alien.x = alien.maxX - 28; alien.dir = -1; }

      if (invincibleTimer <= 0 && rectsOverlap(player, { x: alien.x, y: alien.y, w: 28, h: 32 })) {
        loseLife();
      }
    }
  }

  function updateAsteroids() {
    const level = LEVELS[levelIndex];
    if (!level.asteroids) return;

    asteroidTimer++;
    if (asteroidTimer >= (level.asteroidRate || 120)) {
      asteroidTimer = 0;
      asteroids.push({
        x: Math.random() * (canvas.width - 24),
        y: -30,
        w: 20 + Math.random() * 16,
        h: 20 + Math.random() * 16,
        vy: 3 + levelIndex * 0.5,
      });
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.y += a.vy;
      if (a.y > canvas.height) {
        asteroids.splice(i, 1);
        continue;
      }
      if (invincibleTimer <= 0 && rectsOverlap(player, a)) {
        asteroids.splice(i, 1);
        loseLife();
      }
    }
  }

  function updateCollectibles() {
    for (const item of collectibles) {
      if (item.collected) continue;
      item.bob += 0.08;
      const hitbox = { x: item.x - 8, y: item.y - 8 + Math.sin(item.bob) * 3, w: 16, h: 16 };
      if (rectsOverlap(player, hitbox)) {
        item.collected = true;
        collected[item.type === 'mineral' ? 'minerals' : item.type === 'microbe' ? 'microbes' : 'water']++;
        updateHUD();
        if (goalsMet()) {
          levelComplete();
        }
      }
    }
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, COLORS.skyGradient);
    grad.addColorStop(0.6, COLORS.sky);
    grad.addColorStop(1, '#9b3a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = COLORS.star;
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + frameCount * 0.02) % canvas.width;
      const sy = (i * 89) % (canvas.height * 0.5);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  function drawPlatforms() {
    for (const p of platforms) {
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = COLORS.groundTop;
      ctx.fillRect(p.x, p.y, p.w, 4);

      for (let bx = p.x; bx < p.x + p.w; bx += 16) {
        ctx.fillStyle = '#6b3410';
        ctx.fillRect(bx, p.y + 8, 8, 4);
        ctx.fillRect(bx + 8, p.y + 16, 8, 4);
      }
    }
  }

  function drawCraters() {
    for (const c of craters) {
      ctx.fillStyle = COLORS.crater;
      ctx.beginPath();
      ctx.ellipse(c.x + c.w / 2, c.y + 10, c.w / 2, c.h / 2 + 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0500';
      ctx.beginPath();
      ctx.ellipse(c.x + c.w / 2, c.y + 16, c.w / 2 - 6, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRover(x, y, facing, flash) {
    if (flash) return;

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

  function drawAlien(x, y) {
    ctx.fillStyle = COLORS.alien;
    ctx.fillRect(x + 4, y, 20, 16);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x + 6, y + 4, 6, 6);
    ctx.fillRect(x + 16, y + 4, 6, 6);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 8, y + 6, 2, 2);
    ctx.fillRect(x + 18, y + 6, 2, 2);
    ctx.fillStyle = COLORS.alien;
    ctx.fillRect(x + 2, y + 16, 8, 12);
    ctx.fillRect(x + 18, y + 16, 8, 12);
    ctx.fillRect(x + 8, y + 16, 12, 8);
  }

  function drawCollectible(item) {
    if (item.collected) return;
    const bobY = Math.sin(item.bob) * 3;
    const x = item.x;
    const y = item.y + bobY;

    if (item.type === 'mineral') {
      ctx.fillStyle = COLORS.mineral;
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 8, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffec8b';
      ctx.fillRect(x - 2, y - 4, 4, 4);
    } else if (item.type === 'microbe') {
      ctx.fillStyle = COLORS.microbe;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#228844';
      for (let a = 0; a < 6; a++) {
        const angle = (a / 6) * Math.PI * 2 + item.bob;
        ctx.fillRect(x + Math.cos(angle) * 10 - 2, y + Math.sin(angle) * 10 - 2, 4, 4);
      }
    } else {
      ctx.fillStyle = COLORS.water;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.quadraticCurveTo(x + 10, y, x, y + 10);
      ctx.quadraticCurveTo(x - 10, y, x, y - 10);
      ctx.fill();
      ctx.fillStyle = '#88ccff';
      ctx.fillRect(x - 2, y - 4, 4, 6);
    }
  }

  function drawAsteroid(a) {
    ctx.fillStyle = COLORS.asteroid;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y + a.h * 0.3);
    ctx.lineTo(a.x + a.w * 0.4, a.y);
    ctx.lineTo(a.x + a.w, a.y + a.h * 0.2);
    ctx.lineTo(a.x + a.w * 0.8, a.y + a.h);
    ctx.lineTo(a.x + a.w * 0.2, a.y + a.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.fillRect(a.x + a.w * 0.3, a.y + a.h * 0.3, 4, 4);
    ctx.fillRect(a.x + a.w * 0.6, a.y + a.h * 0.5, 3, 3);
  }

  function render() {
    drawSky();
    drawPlatforms();
    drawCraters();

    for (const item of collectibles) drawCollectible(item);
    for (const alien of aliens) drawAlien(alien.x, alien.y);
    for (const a of asteroids) drawAsteroid(a);

    const flash = invincibleTimer > 0 && Math.floor(invincibleTimer / 6) % 2 === 0;
    drawRover(player.x, player.y, player.facing, flash);
  }

  function update() {
    if (state !== 'playing') return;

    updatePlayer();
    updateAliens();
    updateAsteroids();
    updateCollectibles();

    if (invincibleTimer > 0) invincibleTimer--;
    frameCount++;
  }

  function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    if (e.key === 'ArrowRight') { keys.right = true; e.preventDefault(); }
    if (e.key === 'ArrowUp' || e.key === ' ') { keys.up = true; e.preventDefault(); }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === ' ') keys.up = false;
  });

  startBtn.addEventListener('click', startGame);
  gameLoop();
})();
