/* Sound effects — files in assets/audio/ */

const GameAudio = (function () {
  'use strict';

  const SOUNDS = {
    intro: 'assets/audio/Intro page.ogg',
    cell: 'assets/audio/Collectable_cell.ogg',
    gem: 'assets/audio/Collectable_gem.ogg',
    water: 'assets/audio/Collectable_water.ogg',
    alien: 'assets/audio/Obstacle_alien.ogg',
    crater: 'assets/audio/Obstacle_crater.ogg',
    asteroid: 'assets/audio/Obstacle_asteroid.ogg',
    gameOver: 'assets/audio/mission_failed.ogg',
    winning: 'assets/audio/mission_completed.ogg',
  };

  let unlocked = false;
  let introAudio = null;
  let introStopped = false;

  function unlock() {
    unlocked = true;
  }

  function ensureIntroAudio() {
    if (!introAudio) {
      introAudio = new Audio(SOUNDS.intro);
      introAudio.loop = true;
      introAudio.preload = 'auto';
      introAudio.addEventListener('error', () => {
        console.warn(`[Ark-3] Missing sound file for "intro": ${SOUNDS.intro}`);
      }, { once: true });
    }
    return introAudio;
  }

  function startIntroLoop() {
    if (introStopped) return;
    unlock();
    const audio = ensureIntroAudio();
    audio.play().catch((err) => {
      console.warn('[Ark-3] Intro loop blocked until interaction:', err.message);
    });
  }

  function pauseIntroLoop() {
    if (!introAudio) return;
    introAudio.pause();
  }

  function resumeIntroLoop() {
    if (introStopped) return;
    const audio = ensureIntroAudio();
    audio.play().catch((err) => {
      console.warn('[Ark-3] Could not resume intro loop:', err.message);
    });
  }

  function stopIntroLoop() {
    introStopped = true;
    if (!introAudio) return;
    introAudio.pause();
    introAudio.currentTime = 0;
  }

  function play(key) {
    const src = SOUNDS[key];
    if (!src) {
      console.warn(`[Ark-3] Unknown sound key: ${key}`);
      return;
    }
    const audio = new Audio(src);
    audio.volume = 1;
    audio.play().catch((err) => {
      if (!unlocked) return;
      console.warn(`[Ark-3] Could not play "${key}" (${src}):`, err.message);
    });
  }

  function preload() {
    ensureIntroAudio();
    Object.entries(SOUNDS).forEach(([key, src]) => {
      if (key === 'intro') return;
      const probe = new Audio();
      probe.preload = 'auto';
      probe.src = src;
      probe.addEventListener('error', () => {
        console.warn(`[Ark-3] Missing sound file for "${key}": ${src}`);
      }, { once: true });
    });
  }

  preload();

  return {
    unlock,
    play,
    startIntroLoop,
    pauseIntroLoop,
    resumeIntroLoop,
    stopIntroLoop,
    SOUNDS,
  };
})();
