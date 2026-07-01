# Project Ark-3 — Complete Project Guide

This document describes **everything built so far** in Project Ark-3: a browser-based Mars rover platformer with a human-verification intro (camera + microphone) before gameplay.

For a shorter setup-only checklist, see [INSTRUCTIONS.md](./INSTRUCTIONS.md).

---

## Table of contents

1. [Overview](#overview)
2. [Quick start](#quick-start)
3. [User flow (all screens)](#user-flow-all-screens)
4. [Human verification intro](#human-verification-intro)
5. [Gameplay](#gameplay)
6. [Level progression (10 levels)](#level-progression-10-levels)
7. [Collectibles and hazards](#collectibles-and-hazards)
8. [Visual feedback and damage system](#visual-feedback-and-damage-system)
9. [Assets folder](#assets-folder)
10. [Project structure and file roles](#project-structure-and-file-roles)
11. [How to customize](#how-to-customize)
12. [Troubleshooting](#troubleshooting)
13. [Not yet implemented](#not-yet-implemented)

---

## Overview

**Project Ark-3** is a vanilla HTML/CSS/JavaScript game — no npm, no build step.

| Phase | What happens |
|-------|----------------|
| **Intro (screens 1–3)** | User connects camera/mic, waves, says “pew pew”, gets “Human approved” |
| **Game (screen 4)** | Side-scrolling Mars rover platformer across 10 levels |

**Mission:** Collect **good cells**, **gems**, and **water droplets** on Mars and bring them back to Earth. Avoid **craters**, **hostile aliens**, and **asteroids**. You have **3 lives**. Clear all 10 levels to win.

**Important:** Camera and microphone only work when served over `http://localhost` or `https://`. Opening `index.html` directly (`file://`) will **not** work for the intro.

---

## Quick start

### Prerequisites

- **Cursor** (or any editor) — [https://cursor.com](https://cursor.com)
- **Python 3** — for a local web server (`python3 --version`)
- **Modern browser** — Chrome, Edge, Firefox, or Safari
- **Webcam and microphone**

### Run locally

```bash
cd /path/to/mars-rover-demo
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080) and keep the terminal running.

**Windows** (if `python3` fails):

```bash
python -m http.server 8080
```

**Port in use?** Use `8081` (or any free port) and open the matching URL.

### Daily workflow

1. Open the project folder in Cursor
2. Start the server: `python3 -m http.server 8080`
3. Browser: `http://localhost:8080/`
4. Edit files → hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`)
5. `Ctrl+C` in the terminal when done

---

## User flow (all screens)

| Screen | ID | What the user sees |
|--------|-----|-------------------|
| **1 — Connect** | `connect-screen` | Mission briefing, story text, **Connect camera & microphone** button |
| **2 — Verify** | `preview-screen` | Live camera in a space portal; wave + say “pew pew”; detection badges |
| **3 — Approved** | `approved-screen` | “Human approved” story + **START MISSION** button |
| **4 — Game** | `game-container` | Mars rover platformer (hidden until START MISSION) |

After **START MISSION**, the intro is hidden, the game container is shown, and gameplay begins immediately (no extra in-game start overlay).

---

## Human verification intro

Implemented in `app.js` and styled in `styles.css`.

### Screen 1 — Connect

- Explains the mission and the human check (“not an AI infiltrator”).
- User clicks **Connect camera & microphone**.
- Browser prompts for camera + mic permissions → user must click **Allow**.
- On success, advances to screen 2.

### Screen 2 — Wave and pew pew

- Live video feed in a styled “space portal” frame.
- After a **6-second delay**, two badges appear:
  - **Wave detected**
  - **Pew pew detected**
- Detection runs until both pass.

**Wave detection** (`detectWave`):

- Samples video at 160×120 resolution.
- Compares frames in the **upper 60%** of the image for pixel motion.
- Motion above threshold → wave detected.

**Pew pew detection** (`detectPew`):

- Uses Web Audio `AnalyserNode` on the microphone stream.
- Looks for **two loud peaks** separated by 100–1200 ms (two beats: “pew … pew”).
- Both peaks must exceed the audio level threshold.

### Screen 3 — Human approved

- Shown **1 second** after both wave and pew pew are detected.
- Story text explains the collectibles mission:
  - Good cells, gems, and water droplets lie on Mars.
  - “Your mission: bring these items back to Earth.”
  - “Pilot, you're all we have left.”
- **START MISSION** launches the game.

### Timing constants (`app.js`)

| Constant | Value | Meaning |
|----------|-------|---------|
| `DETECTION_DELAY_MS` | 6000 | Wait before badges appear and detection starts |
| `APPROVED_DELAY_MS` | 1000 | Wait after both checks pass → show approved screen |
| `MOTION_THRESHOLD` | 750 | Pixel motion needed for wave |
| `AUDIO_LOUD` | 32 | Mic level for a “pew” peak |
| `PEW_GAP_MIN_MS` | 100 | Minimum gap between pew beats |
| `PEW_GAP_MAX_MS` | 1200 | Maximum gap between pew beats |

### Game launch

When **START MISSION** is clicked:

1. Camera/mic streams are stopped and released.
2. `#intro-app` is hidden; `#game-container` is shown.
3. A custom event `ark3:start-game` is dispatched.
4. `game.js` listens for that event and initializes the game engine.

### Key DOM IDs (do not rename without updating `app.js`)

- `connect-screen`, `preview-screen`, `approved-screen`
- `connect-btn`, `connect-status`
- `camera-preview`, `motion-canvas`
- `verification-checklist`, `check-wave`, `check-pew`
- `start-game-btn`, `intro-app`, `game-container`

---

## Gameplay

Implemented in `game.js` with level data from `levels.js` and sprites from `assets.js`.

### Controls

| Key | Action |
|-----|--------|
| ← / A | Move left |
| → / D | Move right |
| ↑ / W / Space | Jump |

Click the canvas to focus it if keys stop responding.

### Rules

- **3 lives** (`MAX_LIVES = 3`). Shown as hearts in the HUD.
- **Invincibility** ~1.5 seconds after taking damage (`INVINCIBLE_FRAMES = 90`).
- On damage: lose a life, respawn at level start, brief invincibility.
- On 0 lives: **GAME OVER** — press **Enter** to restart.
- **Level complete:** Collect all required good cells, gems, and water **and** pick up every spawned item on the map.
- **Victory:** Complete level 10 → “Well done, pilot! You completed your mission and saved Planet Earth.” → **PLAY AGAIN**.

### HUD

- Lives, current level (1–10)
- Collectible counters: good cells / gems / water (current vs goal)

### Physics (approximate)

| Constant | Value |
|----------|-------|
| Gravity | 0.55 |
| Jump force | -11 |
| Move speed | 4 |
| Floor Y | 440 |

The camera follows the rover with a slight lead (`CAMERA_LEAD = 0.35`).

---

## Level progression (10 levels)

Levels are defined in `LEVEL_CONFIG` in `levels.js` and built at load time by `buildLevel()`.

Collectible counts scale from **1/1/1** on level 1 to **10/10/10** on level 10 (good cells / gems / water).

| Level | Name | Good cells | Gems | Water | Craters | Aliens | Asteroids |
|-------|------|------------|------|-------|---------|--------|-----------|
| 1 | Dusty Plains | 1 | 1 | 1 | 1 | 1 (stationary) | No |
| 2 | First Contact | 3 | 1 | 1 | 1 | 1 (stationary) | Yes (slow) |
| 3 | Ice Cap Search | 3 | 3 | 3 | 2 | 1 (moving) | Yes (slow) |
| 4 | Asteroid Drift | 4 | 3 | 3 | 2 | 2 | Yes (moderate) |
| 5 | Red Canyon | 5 | 4 | 3 | 3 | 3 | Yes (moderate) |
| 6 | Olympus Approach | 6 | 5 | 4 | 3 | 3 | Yes (2 on screen) |
| 7 | Valles Marineris | 7 | 6 | 5 | 4 | 4 | Yes (fast) |
| 8 | Polar Depths | 8 | 7 | 6 | 4 | 4 | Yes (fast) |
| 9 | Storm Front | 9 | 8 | 7 | 5 | 4 | Yes (faster, 3 max) |
| 10 | Last Hope | 10 | 10 | 10 | 5 | 5 (fast) | Yes (faster, 3 max) |

### Level 10 extras

- **Floating platforms** at mid-air heights for harder traversal.
- **Floating pickups** on those platforms (gem in rock, water, good cell).
- `floatPickups` counts are subtracted from auto-spawn totals so HUD goals stay correct.

### How levels are built

- **Platforms:** Ground segments grow with crater count (gaps between segments = craters).
- **Craters:** Placed from fixed slots; falling in one damages the player.
- **Aliens:** Placed from patrol slots; moving aliens patrol between `minX` and `maxX`.
- **Collectibles:** Auto-spread across the full map width via `buildSpreadPositions()`, avoiding craters and alien zones. Types are interleaved (microbe, gem, water, repeat).
- **Gems in rocks:** From level 3 onward, most gems spawn inside breakable mineral rocks (jump on rock to break and reveal gem).

---

## Collectibles and hazards

### Collectibles

| In-game type | HUD name | Sprite file |
|--------------|----------|-------------|
| `microbe` | Good cells | `assets/good-cell.png` |
| `mineral` | Gems | `assets/gem.png` |
| `water` | Water droplets | `assets/water.png` |

Walk into a collectible to pick it up. Gems may be hidden inside mineral rocks until the rock is broken.

### Hazards

| Hazard | Effect | Sprite file |
|--------|--------|-------------|
| **Crater** | Fall in → damage | `assets/crater.png` |
| **Alien** | Touch → damage | `assets/evil-alien.png` |
| **Asteroid** | Touch → damage | `assets/asteroid.png` |
| **Fall off map** | Fall below surface → damage | (no sprite) |

Asteroid speed and spawn rate increase by level (`ASTEROID_SPEED` and `ASTEROID_FREQUENCY` maps in `levels.js`).

---

## Visual feedback and damage system

### Damage messages

When the player takes damage, a message appears in the sky area (`#damage-message`):

| Reason | Message |
|--------|---------|
| `crater` | Fell into a crater! |
| `alien` | Hit by a hostile alien! |
| `asteroid` | Struck by an asteroid! |
| `fall` | Fell off the surface! |

Messages fade after ~1.5 seconds. Additional feedback includes screen flash, rover shake, and particle effects.

### Good feedback

Collecting items triggers positive visual feedback (background flash, burst stars, collect particles).

### Overlays

- **Level complete** — brief pause, then auto-advance to next level.
- **Game over** — press Enter to restart.
- **Victory** — final message + PLAY AGAIN button.

---

## Assets folder

Sprites live in `assets/` at the project root:

```
assets/
├── gem.png
├── good-cell.png
├── water.png
├── evil-alien.png
├── asteroid.png
├── crater.png
├── rover.png              ← optional (rover draws procedurally if missing)
├── collectables_gems.png  ← source/reference sheets (not used directly in game)
├── collectables_good_cells.png
├── obstacles_bad_aliens.png
├── obstacles_craters.png
├── obstacle_asteroid_beam.png
└── audio/                 ← reserved for future sound effects (empty)
```

`assets.js` loads sprites and optionally strips white/dark backgrounds for transparency. Missing sprites log a console warning; the game still runs with fallback drawing where implemented.

### Adding or replacing a sprite

1. Drop a PNG into `assets/` (same filename as in `assets.js` → `SPRITES` map).
2. Hard refresh the browser.
3. Check the browser console for `[Project Ark-3] Sprites loaded` messages.

---

## Project structure and file roles

| File | Role |
|------|------|
| `index.html` | Intro screens (1–3) + hidden game container (4); loads all scripts |
| `styles.css` | Space intro theme, portal frame, verification badges, game HUD, damage message, overlays |
| `app.js` | Camera/mic access, wave + pew pew detection, screen flow, `ark3:start-game` event |
| `game.js` | Rover physics, rendering, collisions, HUD, damage, level complete, victory |
| `levels.js` | `LEVEL_CONFIG`, platform/crater/alien slots, `buildLevel()` → `LEVELS` array |
| `assets.js` | Sprite loading, background stripping, `GameAssets.drawSprite()` helpers |
| `README.md` | Short project summary |
| `INSTRUCTIONS.md` | Setup checklist for a new machine |
| `PROJECT_GUIDE.md` | This file — full feature and implementation reference |

### Script load order (`index.html`)

```html
<script src="app.js"></script>
<script src="assets.js"></script>
<script src="levels.js"></script>
<script src="game.js"></script>
```

`game.js` waits for `ark3:start-game` before starting if `#game-container` is hidden.

---

## How to customize

### Change intro timing

Edit constants at the top of `app.js` (`DETECTION_DELAY_MS`, `APPROVED_DELAY_MS`, etc.).

### Change intro copy

Edit text in `index.html` inside the `#connect-screen`, `#preview-screen`, and `#approved-screen` sections.

### Add or edit a level

Edit `LEVEL_CONFIG` in `levels.js`. Each entry supports:

```javascript
{
  level: 1,
  name: 'Level Name',
  collectibles: { goodCells: 1, gems: 1, water: 1 },
  hazards: { craters: 1, aliens: 1, asteroidsEnabled: false },
  difficulty: {
    alienMoves: false,
    alienSpeed: 0,
    asteroidSpeed: 'slow',      // slow | moderate | fast | faster
    asteroidFrequency: 'low',     // low | moderate | high | veryHigh
    maxAsteroids: 1,
  },
  floatingPlatforms: [],          // optional — level 10 only today
  floatPickups: [],               // optional — mid-air pickups
}
```

Collectibles on the ground are auto-placed; you only need manual `floatPickups` for special mid-air items.

### Change lives or physics

Edit constants at the top of `game.js` (`MAX_LIVES`, `GRAVITY`, `JUMP_FORCE`, `MOVE_SPEED`, etc.).

### Change damage messages

Edit `DAMAGE_MESSAGES` in `game.js`.

### Change victory / game over text

Edit `showGameOverScreen()` and `levelComplete()` in `game.js`.

---

## Troubleshooting

### `ERR_CONNECTION_REFUSED`

Server not running. Start `python3 -m http.server 8080`.

### Camera/mic never prompted

Use `http://localhost:8080/` — do not open `index.html` as a file.

### Permission denied

Allow camera + mic in the browser and in system Privacy settings. Close Zoom, FaceTime, or Teams if the camera is in use.

### Pew pew never detected

Speak clearly in two beats (“pew … pew”); check mic input level; hard refresh and retry.

### Wave never detected

Wait the full 6 seconds for badges to appear; wave in the **upper half** of the frame with good lighting.

### Game keys not working

Click the canvas to focus it.

### Sprites not showing

Confirm PNG files exist in `assets/` and check the browser console for missing-sprite warnings.

### `assets/` folder not visible in Cursor

The folder is at the project root (between `app.js` and `assets.js`). Try refreshing the file explorer or opening `assets/gem.png` directly via **File → Open File**.

---

## Not yet implemented

These were discussed but are **not** wired up yet:

- **Sound effects** — `assets/audio/` folder exists; no `audio.js` or sound hooks for collect, damage, level complete, or victory events.

To add sounds later:

1. Place `.mp3` or `.wav` files in `assets/audio/`.
2. Create a small audio module to preload and play clips.
3. Call play functions from collect/damage/level-complete handlers in `game.js`.

---

## Test checklist

- [ ] Server running; `http://localhost:8080/` loads
- [ ] Screen 1 intro and connect button work
- [ ] Camera + microphone allowed
- [ ] Screen 2 portal shows live video
- [ ] After 6s, wave/pew pew badges appear
- [ ] Both badges turn green
- [ ] “Human approved” screen appears
- [ ] START MISSION begins gameplay immediately
- [ ] Collectibles update HUD counters
- [ ] Craters, aliens, and asteroids cause damage with correct messages
- [ ] Level advances when all goals met
- [ ] Level 10 victory screen and PLAY AGAIN work
