/* Fixed sprites — one image per object type, no random variants. */

const GameAssets = (function () {
  'use strict';

  /** Bump when sprite files change so browsers don't serve stale cached PNGs. */
  const ASSET_VERSION = '20260701-asteroid-beam-v4';

  const SPRITES = {
    rover: { src: 'assets/rover.png', optional: true },
    gem: { src: 'assets/gem.png', stripWhite: true, stripDark: true, stripDarkBlue: true },
    goodCell: { src: 'assets/good-cell.png', stripWhite: true },
    water: { src: 'assets/water.png', stripWhite: true },
    evilAlien: { src: 'assets/evil-alien.png' },
    levelBackground: { src: 'assets/mars-background.png' },
    marsGround: { src: 'assets/mars-ground.png' },
    marsCrater: { src: 'assets/mars-crater.png' },
    asteroid: { src: 'assets/asteroid.png' },
  };

  const images = {};
  const missing = new Set();
  let ready = false;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${src}`));
      img.src = `${src}?v=${ASSET_VERSION}`;
    });
  }

  function stripBackground(img, mode) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const c = canvas.getContext('2d');
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    for (let i = 0; i < px.length; i += 4) {
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const isWhite = r > 235 && g > 235 && b > 235;
      const isDark = r < 75 && g < 80 && b < 100;
      const isDarkBlue = r < 60 && g < 70 && b < 95 && b > r;
      const dr = r - 70;
      const dg = g - 48;
      const db = b - 80;
      const isPurpleBg = dr * dr + dg * dg + db * db < 900;
      if ((mode === 'white' && isWhite)
        || (mode === 'dark' && isDark)
        || (mode === 'darkBlue' && isDarkBlue)
        || (mode === 'purple' && isPurpleBg)) {
        px[i + 3] = 0;
      }
    }

    c.putImageData(data, 0, 0);
    const out = new Image();
    return new Promise((resolve) => {
      out.onload = () => resolve(out);
      out.src = canvas.toDataURL('image/png');
    });
  }

  function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      else if (max === gn) h = ((bn - rn) / d + 2) / 6;
      else h = ((rn - gn) / d + 4) / 6;
    }

    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }

    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ];
  }

  function brightenPurpleSprite(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const c = canvas.getContext('2d');
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 20) continue;

      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);

      const isMouthPink = r > 145 && g < 125 && b < 135 && r > g + 25;
      const isPurpleBody =
        !isMouthPink &&
        ((h >= 0.62 && h <= 0.9 && s > 0.1 && l < 0.8) ||
          (b > r + 8 && r > g - 20 && l < 0.75));

      if (!isPurpleBody) continue;

      const newL = Math.min(0.9, l * 1.42 + 0.16);
      const newS = Math.min(1, s * 1.12);
      const [nr, ng, nb] = hslToRgb(h, newS, newL);
      px[i] = nr;
      px[i + 1] = ng;
      px[i + 2] = nb;
    }

    c.putImageData(data, 0, 0);
    const out = new Image();
    return new Promise((resolve) => {
      out.onload = () => resolve(out);
      out.src = canvas.toDataURL('image/png');
    });
  }

  function brightenSprite(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const c = canvas.getContext('2d');
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 20) continue;

      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      const newL = Math.min(0.96, l * 1.22 + 0.1);
      const newS = Math.min(1, s * 1.1);
      const [nr, ng, nb] = hslToRgb(h, newS, newL);
      px[i] = nr;
      px[i + 1] = ng;
      px[i + 2] = nb;
    }

    c.putImageData(data, 0, 0);
    const out = new Image();
    return new Promise((resolve) => {
      out.onload = () => resolve(out);
      out.src = canvas.toDataURL('image/png');
    });
  }

  function brightenTerrainSprite(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const c = canvas.getContext('2d');
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 20) continue;
      const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
      const newL = Math.min(0.97, l * 1.16 + 0.08);
      const newS = Math.min(1, s * 1.08);
      const [nr, ng, nb] = hslToRgb(h, newS, newL);
      px[i] = nr;
      px[i + 1] = ng;
      px[i + 2] = nb;
    }

    c.putImageData(data, 0, 0);
    const out = new Image();
    return new Promise((resolve) => {
      out.onload = () => resolve(out);
      out.src = canvas.toDataURL('image/png');
    });
  }

  function adjustCraterTerrainSprite(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const c = canvas.getContext('2d');
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 20) continue;

      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);

      const isPit =
        l < 0.24 ||
        (r < 55 && g < 45 && b < 42) ||
        (r < 75 && g < 58 && b < 52 && l < 0.32);

      if (isPit) {
        const newL = Math.max(0, l * 0.38 - 0.04);
        const [nr, ng, nb] = hslToRgb(h, Math.min(1, s * 0.9), newL);
        px[i] = nr;
        px[i + 1] = ng;
        px[i + 2] = nb;
        continue;
      }

      const newL = Math.min(0.97, l * 1.22 + 0.1);
      const newS = Math.min(1, s * 1.1);
      const [nr, ng, nb] = hslToRgb(h, newS, newL);
      px[i] = nr;
      px[i + 1] = ng;
      px[i + 2] = nb;
    }

    c.putImageData(data, 0, 0);
    const out = new Image();
    return new Promise((resolve) => {
      out.onload = () => resolve(out);
      out.src = canvas.toDataURL('image/png');
    });
  }

  function getSpriteSrc(key) {
    const img = images[key];
    return img ? img.src : null;
  }

  function applyHudIcons() {
    const map = [
      ['goodCell', 'hud-icon-cell'],
      ['gem', 'hud-icon-gem'],
      ['water', 'hud-icon-water'],
    ];
    for (const [key, id] of map) {
      const src = getSpriteSrc(key);
      const el = document.getElementById(id);
      if (src && el) el.src = src;
    }
  }

  async function loadAll() {
    const loads = Object.entries(SPRITES).map(async ([key, cfg]) => {
      try {
        let img = await loadImage(cfg.src);
        if (cfg.stripWhite) img = await stripBackground(img, 'white');
        if (cfg.stripPurple) img = await stripBackground(img, 'purple');
        if (cfg.stripDark) img = await stripBackground(img, 'dark');
        if (cfg.stripDarkBlue) img = await stripBackground(img, 'darkBlue');
        if (cfg.brightenPurple) img = await brightenPurpleSprite(img);
        if (cfg.brighten) img = await brightenSprite(img);
        if (cfg.brightenTerrain) img = await brightenTerrainSprite(img);
        if (cfg.adjustCraterTerrain) img = await adjustCraterTerrainSprite(img);
        images[key] = img;
      } catch (err) {
        missing.add(key);
        console.warn(
          `[Project Ark-3] Missing sprite "${key}": could not load ${cfg.src}. ` +
          'Add this file or the object will not be drawn.'
        );
      }
    });

    await Promise.all(loads);
    ready = true;

    const loaded = Object.keys(SPRITES).filter((k) => images[k]);
    const skipped = [...missing];
    console.info(
      `[Project Ark-3] Sprites loaded (${loaded.length}/${Object.keys(SPRITES).length}):`,
      loaded.join(', ') || 'none'
    );
    if (skipped.length) {
      console.warn(`[Project Ark-3] Missing sprites: ${skipped.join(', ')}`);
    }

    applyHudIcons();
  }

  function isReady() {
    return ready;
  }

  function hasSprite(key) {
    return !!images[key];
  }

  function drawSprite(ctx, key, cx, cy, w, h) {
    const img = images[key];
    if (!img) return false;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    return true;
  }

  function drawSpriteTop(ctx, key, cx, top, w, h) {
    const img = images[key];
    if (!img) return false;
    ctx.drawImage(img, cx - w / 2, top, w, h);
    return true;
  }

  function drawStretchedHorizontal(ctx, key, x, top, totalW, h) {
    const img = images[key];
    if (!img) return false;
    ctx.drawImage(img, Math.floor(x), Math.round(top), Math.ceil(totalW), Math.round(h));
    return true;
  }

  function drawTiledHorizontal(ctx, key, x, top, totalW, h, worldX = x) {
    const img = images[key];
    if (!img) return false;

    const drawH = Math.round(h);
    const drawTop = Math.round(top);
    const tileW = Math.round(img.width * (drawH / img.height));
    if (tileW <= 0) return false;

    const start = Math.floor(x);
    const end = Math.ceil(x + totalW);
    const phase = ((Math.floor(worldX) % tileW) + tileW) % tileW;
    let cursor = start;

    if (phase > 0) {
      const drawW = Math.min(tileW - phase, end - cursor);
      if (drawW > 0) {
        const srcX = Math.round((phase / tileW) * img.width);
        const srcW = img.width - srcX;
        ctx.drawImage(img, srcX, 0, srcW, img.height, cursor, drawTop, drawW, drawH);
        cursor += drawW;
      }
    }

    while (cursor < end) {
      const remaining = end - cursor;
      const drawW = Math.min(tileW, remaining);
      const overlap = cursor + drawW < end ? 2 : 0;
      ctx.drawImage(img, 0, 0, img.width, img.height, cursor, drawTop, drawW + overlap, drawH);
      cursor += drawW;
    }
    return true;
  }

  /** Draw sprite at native aspect ratio, centered on (cx, cy). */
  function drawSpriteAspect(ctx, key, cx, cy, targetH) {
    const img = images[key];
    if (!img) return false;
    const aspect = img.width / img.height;
    const drawH = targetH;
    const drawW = targetH * aspect;
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    return true;
  }

  /** Draw sprite at native aspect ratio, top-aligned at (left, top). */
  function drawSpriteAspectTop(ctx, key, left, top, targetH) {
    const img = images[key];
    if (!img) return false;
    const aspect = img.width / img.height;
    const drawH = targetH;
    const drawW = targetH * aspect;
    ctx.drawImage(img, left, top, drawW, drawH);
    return true;
  }

  /**
   * Fixed level backdrop — drawn in screen space (call before world translate).
   * Stays still while the camera scrolls the ground and gameplay layer.
   */
  function drawLevelBackground(ctx, canvasW, canvasH) {
    const img = images.levelBackground;
    if (!img) return false;

    if (!drawLevelBackground.cache) {
      const cache = document.createElement('canvas');
      cache.width = canvasW;
      cache.height = canvasH;
      const c = cache.getContext('2d');
      const scale = Math.max(canvasW / img.width, canvasH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const x = (canvasW - drawW) / 2;
      const y = (canvasH - drawH) / 2;
      c.drawImage(img, x, y, drawW, drawH);
      drawLevelBackground.cache = cache;
    }

    ctx.drawImage(drawLevelBackground.cache, 0, 0);
    return true;
  }

  /**
   * Draw asteroid with a stretched beam and a smaller rock at the impact end.
   * beamSrcH — source rows [0, beamSrcH) contain only the vertical ray (no rock).
   * beamSrcW — horizontal crop width centered on the ray.
   */
  function drawAsteroidComposite(ctx, key, cx, top, totalH, rockDrawH, beamSrcH, beamSrcW, beamDrawW) {
    const img = images[key];
    if (!img) return false;

    const beamDrawH = Math.max(0, totalH - rockDrawH);
    const rockTop = top + beamDrawH;
    const rockSrcY = beamSrcH;
    const rockSrcH = img.height - rockSrcY;
    const beamSrcX = Math.round((img.width - beamSrcW) / 2);

    if (beamDrawH > 0 && beamSrcH > 0) {
      ctx.drawImage(
        img,
        beamSrcX, 0, beamSrcW, beamSrcH,
        cx - beamDrawW / 2, top, beamDrawW, beamDrawH
      );
    }

    if (rockDrawH > 0 && rockSrcH > 0) {
      const rockW = rockDrawH * (img.width / rockSrcH);
      ctx.drawImage(
        img,
        0, rockSrcY, img.width, rockSrcH,
        cx - rockW / 2, rockTop, rockW, rockDrawH
      );
    }

    return true;
  }

  return {
    loadAll,
    isReady,
    hasSprite,
    drawSprite,
    drawSpriteTop,
    drawSpriteAspect,
    drawSpriteAspectTop,
    drawTiledHorizontal,
    drawStretchedHorizontal,
    drawAsteroidComposite,
    drawLevelBackground,
    getSpriteSrc,
    applyHudIcons,
    SPRITES,
  };
})();
