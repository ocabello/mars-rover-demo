# Project Ark-3 — Setup Instructions for Cursor

Use this guide on a **new computer** to run the human-verification intro and Mars rover game.  
No npm install, no build step — plain HTML/CSS/JS and a local web server.

---

## What this project does

A **4-screen browser flow** for **Project Ark-3**:

| Screen | What the user sees |
|--------|-------------------|
| **1 — Intro + connect** | Game title, “Prove you’re human” story, **Connect camera & microphone** button |
| **2 — Camera** | “Wave and say pew pew”, live video in a space portal, **dark navy backdrop with twinkling stars**, detection badges after **3 seconds** |
| **3 — Approved** | “Human approved” after wave + pew pew are detected (+ 1 second). Intro music resumes here. |
| **4 — Game** | **START MISSION** → Mars rover platformer (10 levels, obstacles, horizontal scrolling) |

**Important:** Camera and microphone only work when the site is served over **`http://localhost`** or **`https://`**.  
Opening `index.html` directly from the file explorer (`file://`) will **not** work for the intro.

---

## Gameplay summary

- **Collect:** good cells, gems, water droplets (HUD shows progress with the same sprite icons used in-game).
- **Avoid:** craters, hostile aliens, falling asteroids.
- **Lives:** 3. Lives carry over between levels; collectible counts reset each level.
- **Win:** Complete all **10 levels** → victory screen (“Well done, pilot!” / mission completed).
- **Lose:** 0 lives → game over (mission failed). Press **Enter** to restart.
- **Level complete:** A level does not finish until **all required collectibles** for that level are collected. The last required item is placed near the **end of the level**, so the player must travel right to finish. After the final pickup, **“Level Complete!”** appears and the game advances automatically (~1.5 s).

### Controls

| Key | Action |
|-----|--------|
| ← → or **A / D** | Move left / right |
| ↑ or **Space** or **W** | Jump |

**Tip:** If the rover stops responding but hazards still move, **click the game canvas** once — the browser may have lost keyboard focus. A faint orange focus ring appears when the canvas has focus. Keys are also cleared when the tab loses focus or is hidden.

### Horizontal scrolling & camera

- Canvas size: **800 × 480** (`#game-canvas` in `index.html`).
- Each level is **`canvas.width × levelNumber`** pixels wide (world coordinates).
- The camera **follows the rover** as it moves right (`CAMERA_LEAD = 0.35`, smooth lerp `CAMERA_SMOOTH = 0.12`).
- From **Level 2 onward**, the full level is **not visible at once** — the player must scroll right.
- World objects draw at `object.x - cameraX` via `ctx.translate(-cameraX, 0)` in `game.js`.
- The **HUD stays fixed** on screen (lives, level, score, collectible progress).

| Level | World width | Screens |
|-------|-------------|---------|
| 1 | 800 px | 1 |
| 2 | 1,600 px | 2 |
| 3 | 2,400 px | 3 |
| 4 | 3,200 px | 4 |
| 5 | 4,000 px | 5 |
| 6 | 4,800 px | 6 |
| 7 | 5,600 px | 7 |
| 8 | 6,400 px | 8 |
| 9 | 7,200 px | 9 |
| 10 | 8,000 px | 10 |

### Level progression (full 1–10 table)

Difficulty ramps via `LEVEL_CONFIG` in `levels.js`. Levels are **procedurally generated** at load time by `generateLevel()`.

| Level | Name | Craters | Aliens | Asteroids | Collectibles (cells / gems / water) | Total items |
|-------|------|---------|--------|-----------|-------------------------------------|-------------|
| 1 | Dusty Plains | 1 | 1 (still) | Off | 1 / 1 / 1 | 3 |
| 2 | First Contact | 1 | 1 (still) | Slow, rare | 2 / 2 / 1 | 5 |
| 3 | Ice Cap Search | 2 | 1 (moving) | Slow | 3 / 3 / 3 | 9 |
| 4 | Asteroid Drift | 2 | 2 | Moderate | 3 / 3 / 2 | 8 |
| 5 | Red Canyon | 3 | 3 | Moderate | 4 / 3 / 2 | 9 |
| 6 | Olympus Approach | 3 | 3 | Faster | 4 / 4 / 3 | 11 |
| 7 | Valles Marineris | 4 | 4 | Fast | 5 / 4 / 3 | 12 |
| 8 | Polar Depths | 4 | 4 | Fast | 5 / 5 / 4 | 14 |
| 9 | Storm Front | 5 (full map) | 4 | Fastest | 6 / 5 / 4 | 15 |
| 10 | Last Hope | 5 + floating rocks | 5 | Hardest | 6 / 6 / 5 (3 aerial) | 17 |

**Progression feel:**
- Level 1 fits one screen — short tutorial.
- Each level extends farther right; the player travels a longer journey across Mars.
- More collectibles → longer world width, so items are spread out instead of clustered at spawn.

### Collectible placement rules

Implemented in `generateCollectibles()` / `buildPlacementSegments()` in `levels.js`:

| Rule | Detail |
|------|--------|
| Spread across full level | Items distributed along the entire world width |
| Final item near end | Last required pickup snapped near `levelWidth - screenWidth × 0.12` (end of final screen) |
| Before first crater | **Max 1** collectible |
| Between two obstacles | **Max 2** collectibles |
| Hazard clearance | Not placed on aliens, inside craters, or in unreachable spots |
| Safe landing | Positions respect walkable platform spans with clearance for jumps |
| Gems in rocks | From **level 3+**, most gems (not the last one) spawn inside breakable rocks — jump on top to crack them open |
| Level 10 aerial | 3 floating platforms at ~32%, 52%, 72% of level width with matching float pickups (mineral in rock, water, microbe) |

### Obstacle generation

`generateObstacles()` in `levels.js`:

- **Craters** — evenly distributed across usable width (20% start buffer, 10% end buffer, minimum gap scales with screen width).
- **Ground platforms** — `generatePlatforms()` builds segments between craters spanning the full level width.
- **Aliens** — placed on walkable spans; stationary on levels 1–2, patrolling from level 3+.

### Visual feedback

- **Good** (collecting an item): gold sky flash, sparkles, rover glow, collect burst.
- **Bad** (damage): red sky pulse, rover shake/blink, on-screen damage message, lose 1 life, brief invincibility (~1.5 s).

### Damage messages (current copy)

| Cause | Message |
|-------|---------|
| Alien | Hit by a hostile alien! |
| Crater / fall | Fell into a crater! |
| Asteroid | Struck by an asteroid! |

Messages appear centered on the canvas for ~1.5 seconds.

---

## Sound effects

Audio files live in **`assets/audio/`**. Logic is in **`sounds.js`**.

| File | When it plays |
|------|----------------|
| `Intro page.ogg` | **Loops** on intro screen 1 and screen 3 (Human approved). **Pauses** while the camera is active (screen 2) so “pew pew” detection is not drowned out. **Stops** when START MISSION is clicked. |
| `Collectable_cell.ogg` | Pick up a good cell |
| `Collectable_gem.ogg` | Pick up a gem |
| `Collectable_water.ogg` | Pick up water |
| `Obstacle_alien.ogg` | Lose a life to an alien |
| `Obstacle_crater.ogg` | Lose a life to a crater or falling off the map |
| `Obstacle_asteroid.ogg` | When the **round bottom** of the falling asteroid beam **hits the ground** (not at spawn) |
| `mission_failed.ogg` | Game over (0 lives) |
| `mission_completed.ogg` | All 10 levels cleared (victory) |

Browsers may block audio until the user clicks or taps the intro once.

---

## Visual assets (sprites)

Each object type uses **one fixed sprite** — no random variants. Configured in **`assets.js`**.

| Key | File | Notes |
|-----|------|-------|
| `goodCell` | `assets/good-cell.png` | White background stripped at load |
| `gem` | `assets/gem.png` | White/dark backgrounds stripped |
| `water` | `assets/water.png` | White background stripped |
| `evilAlien` | `assets/evil-alien.png` | Pink capsule alien with tentacles and fangs; **pre-baked transparent background**; drawn 52×64 px, feet on ground |
| `asteroid` | `assets/asteroid.png` | Dark background stripped |
| `rover` | `assets/rover.png` | Optional — procedural fallback if missing |

**Craters** are drawn procedurally (side-view cross-section pit). The crater sprite overlay was removed so only the pit art shows.

**HUD icons** — `#hud-icon-cell`, `#hud-icon-gem`, `#hud-icon-water` are updated from processed sprite sources after `GameAssets.loadAll()`.

**Cache busting** — Sprite URLs append `?v=ASSET_VERSION` (currently `20260630-alien` in `assets.js`). Script tags in `index.html` also use `?v=20260630`. **Bump `ASSET_VERSION`** (and script query strings) whenever you replace a PNG, then hard-refresh the browser.

Legacy sprite sheets in `assets/` (e.g. `collectables_gems.png`, `obstacles_bad_aliens.png`) are **ignored** by the loader. Missing sprites log a console warning.

---

## Prerequisites (new computer)

1. **Cursor** — [https://cursor.com](https://cursor.com)
2. **Python 3** — for the local web server  
   - Mac: usually pre-installed; test with `python3 --version`  
   - Windows: install from [https://www.python.org](https://www.python.org) and check “Add Python to PATH”
3. **A modern browser** — Chrome, Edge, Firefox, or Safari
4. **Working webcam and microphone** — close Zoom/FaceTime if the camera is “in use”

---

## Quick start

### 1. Open the project in Cursor

**File → Open Folder…** and select this project folder (`mars-rover-demo`).

### 2. Start the local server

In the terminal:

```bash
cd /path/to/mars-rover-demo
python3 -m http.server 8080
```

**Windows** (if `python3` fails):

```bash
python -m http.server 8081
```

Leave the terminal open. Open:

```
http://localhost:8080/
```

If port 8080 is already in use, pick another port (e.g. `8081`, `9876`).

### 3. Test the full flow

1. **Screen 1** — Intro music may start after your first click/tap. Click **Connect camera & microphone** → **Allow** in the browser prompt.
2. **Screen 2** — Music pauses. Navy starfield behind the portal. Wave and say **“pew pew”** (two beats). After **3 seconds**, badges appear; both turn green when detected.
3. **Screen 3** — **Human approved** (~1 second after both checks pass). Intro music resumes.
4. **Game** — Click **START MISSION** — gameplay begins immediately on Level 1.

---

## Project structure

| File / folder | Role |
|---------------|------|
| `index.html` | Intro screens + game container + versioned script tags |
| `styles.css` | Space intro theme, navy starfield (`preview-space`), game HUD/canvas |
| `app.js` | Camera/mic, wave + pew pew detection, intro screen flow, intro music pause/resume |
| `sounds.js` | All sound effects + looping intro music API |
| `game.js` | Mars rover gameplay, smooth camera, feedback, damage, HUD updates, keyboard focus |
| `levels.js` | `LEVEL_CONFIG`, procedural `generateLevel()` / `generateObstacles()` / `generateCollectibles()` |
| `assets.js` | Fixed sprite loading, background stripping, cache-busting `ASSET_VERSION` |
| `assets/` | Sprites (`gem.png`, `good-cell.png`, `evil-alien.png`, etc.) |
| `assets/audio/` | `.ogg` sound files |
| `INSTRUCTIONS.md` | This file |
| `PROJECT_GUIDE.md` | Extended design notes (optional reference) |

### Key IDs (do not rename without updating JS)

- `intro-app`, `connect-screen`, `preview-screen`, `approved-screen`
- `connect-btn`, `connect-status`
- `camera-preview`, `motion-canvas`
- `verification-checklist`, `check-wave`, `check-pew`
- `start-game-btn`
- `game-container`, `game-canvas`, `hud-icon-cell`, `hud-icon-gem`, `hud-icon-water`

### Timing constants in `app.js`

| Constant | Value | Meaning |
|----------|-------|---------|
| `DETECTION_DELAY_MS` | **3000** | Wait after camera opens before badges appear and detection starts |
| `APPROVED_DELAY_MS` | 1000 | Wait after both detected → Human approved |

### Camera constants in `game.js`

| Constant | Value | Meaning |
|----------|-------|---------|
| `CAMERA_LEAD` | 0.35 | Rover sits ~35% from left edge while scrolling |
| `CAMERA_SMOOTH` | 0.12 | Lerp factor for smooth camera follow |
| `FLOOR_Y` | 440 | Ground level |

### Level generation API (`levels.js`)

| Function | Purpose |
|----------|---------|
| `generateLevel(levelConfig, screenWidth)` | Builds full level: width, platforms, craters, aliens, collectibles |
| `generateObstacles(levelConfig, levelWidth, screenWidth)` | Craters + aliens + ground platforms |
| `generatePlatforms(levelWidth, craters)` | Walkable segments between craters |
| `generateCollectibles(...)` | Spreads pickups with segment rules; handles L10 float pickups |
| `buildAerialContent(...)` | Level 10 floating platforms and aerial collectibles |
| `assertSpawnMatchesRequired()` | Validates HUD goals match spawned counts |
| `assertPlacementRules()` | Warns in console if spacing rules are violated |

Exported as `const LEVELS = LEVEL_CONFIG.map((cfg) => generateLevel(cfg));`

### Game events (custom)

- `ark3:start-game` — Dispatched when **START MISSION** is clicked; `game.js` listens and starts the engine.

---

## Troubleshooting

### `ERR_CONNECTION_REFUSED`

The server is not running. Start `python3 -m http.server 8080` and keep the terminal open.

### Camera/mic never asked

Use `http://localhost:8080/` — do not double-click `index.html`.

### Permission denied

Allow camera + mic in the browser address bar and in system Privacy settings. Close other apps using the camera.

### Pew pew never detected

Speak clearly in two beats; check mic input level; hard refresh and try again. Intro music is paused on the camera screen so it should not interfere.

### Wave never detected

Wait the full **3 seconds** after the camera opens; wave in the **upper half** of the frame with good lighting.

### Rover “freezes” but aliens/asteroids still move

Keyboard focus was lost. **Click the game canvas**, then use arrow keys (or WASD). The game also clears stuck keys when the tab loses focus.

### No sound

Click the intro or game once to satisfy browser autoplay rules. Check the console for missing files under `assets/audio/`.

### Port already in use

```bash
python3 -m http.server 8081
```

Open `http://localhost:8081/` instead.

### Missing sprites

Open the browser console — `[Project Ark-3] Missing sprite` warnings list which PNG is absent in `assets/`.

### Sprite didn’t update after replacing a PNG

Browsers cache static assets aggressively.

1. Bump `ASSET_VERSION` in `assets.js`.
2. Bump `?v=` on script tags in `index.html` if needed.
3. **Hard refresh:** `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows).
4. Confirm the server is running from the correct project folder.

### Collectibles clustered at start

Should not happen with current procedural placement. If it does, check the browser console for `[Project Ark-3]` placement warnings and verify `levels.js` is the latest version (hard refresh).

---

## Daily workflow

1. Open project in Cursor  
2. `python3 -m http.server 8080`  
3. Browser: `http://localhost:8080/`  
4. Edit files → hard refresh (`Cmd+Shift+R` / `Ctrl+Shift+R`)  
5. After changing sprites, bump `ASSET_VERSION` in `assets.js`  
6. `Ctrl+C` in terminal when done  

---

## Checklist

- [ ] Server running; `http://localhost:8080/` loads  
- [ ] Screen 1 intro and connect button work  
- [ ] Intro music loops on screen 1 (after first interaction if needed)  
- [ ] Camera + microphone allowed  
- [ ] Screen 2 shows navy starfield + camera portal  
- [ ] Music pauses on camera screen  
- [ ] After **3 s**, wave/pew pew badges appear  
- [ ] Both badges turn green  
- [ ] “Human approved” appears; music resumes  
- [ ] “START MISSION” begins gameplay immediately  
- [ ] Level 1 fits one screen; Level 2+ requires scrolling right  
- [ ] Only one collectible before first crater; rest spread along the level  
- [ ] HUD shows sprite icons for cells / gems / water  
- [ ] Pink tentacled alien sprite visible (not old cached sprite)  
- [ ] Collect, damage, asteroid impact, game over, and win sounds play  
- [ ] Level completes only after all required items collected  
- [ ] All 10 levels completable; victory screen appears  
