// hud.js — everything nailed to the glass instead of the world.
//
// Cash and health top-left, the stars top-right, the job in hand across
// the top, the pistol along the bottom, and the minimap in the corner
// keeping Leo found. Plus the things that only appear when they matter:
// the bust meter, the banner, the dialogue box, the prompt, and a gold
// arrow for objectives too far away to see.
import { BUST_TIME, HEAT_PER_STAR, WORLD_H, WORLD_W } from './config.js';
import { districtNameAt, roadCenterX, roadCenterY } from './city.js';

const FONT = 'system-ui, -apple-system, sans-serif';

/** A smoked-glass panel behind a cluster of readouts. */
function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(10, 16, 26, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

export class HUD {
  draw(ctx, game, w, h) {
    this.drawStatus(ctx, game);
    this.drawObjective(ctx, game, w);
    this.drawWeapon(ctx, game, h);
    this.drawEdgeArrow(ctx, game, w, h);
    this.drawMinimap(ctx, game, w, h);
    this.drawBustMeter(ctx, game, w);
    if (game.bannerState) this.drawBanner(ctx, game, w, h);
    if (game.dialogue) this.drawDialogue(ctx, game, w, h);
    if (game.prompt) this.drawPrompt(ctx, game, w, h);
  }

  drawStatus(ctx, game) {
    panel(ctx, 14, 14, 218, 64);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 26, 44);
    // The health bar belongs to whoever is taking the risk: Leo on foot,
    // his car while he is in it. Under it, a line saying which — and in
    // a car, how fast the risk is currently travelling.
    const subject = game.player.car ?? game.player;
    const hp = Math.max(0, Math.round(subject.health));
    const maxHp = subject.maxHealth ?? 100;
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(26, 54, 150, 9);
    ctx.fillStyle = hp > maxHp * 0.35 ? '#06d6a0' : '#ef476f';
    ctx.fillRect(26, 54, 150 * Math.min(1, hp / maxHp), 9);
    ctx.fillStyle = '#e8e3d8';
    ctx.font = `11px ${FONT}`;
    if (game.player.car) {
      const kmh = Math.round(Math.abs(game.player.car.speed) * 0.36);
      ctx.fillText(`${game.player.car.type.name}  ·  ${kmh} km/h`, 26, 74);
    } else {
      ctx.fillText('ON FOOT', 26, 74);
    }
  }

  /** The pistol, bottom-left: a pip for every round in the magazine, the
   * reserve count under it, and a red warning in place of both while a
   * reload is running — the two seconds Sunhaven holds its breath. */
  drawWeapon(ctx, game, h) {
    const c = game.combat;
    panel(ctx, 14, h - 58, 218, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8e3d8';
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText('PISTOL', 26, h - 32);
    // The last three rounds burn orange: a quiet warning, before the
    // click, that the next conversation with the SHD may be one-sided.
    const pip = c.mag <= 3 && c.reloadT <= 0 ? '#ef8354' : '#ffd166';
    for (let i = 0; i < 12; i += 1) {
      ctx.fillStyle = i < c.mag ? pip : 'rgba(232,227,216,0.22)';
      ctx.beginPath();
      ctx.arc(76 + i * 11, h - 36, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = c.reloadT > 0 ? '#ef476f' : 'rgba(232,227,216,0.75)';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(c.reloadT > 0 ? 'RELOADING…' : `reserve ${c.reserve}`, 76, h - 21);
  }

  /** An objective off-screen gets a gold arrow riding the screen edge,
   * with the distance under it: no job should ever be lost to a minimap
   * dot. On-screen objectives need no arrow and get none. */
  drawEdgeArrow(ctx, game, w, h) {
    const obj = game.missions.objective(game);
    if (!obj || !obj.target) return;
    const p = game.player.car ?? game.player;
    const sx = obj.target.x - game.camera.x + w / 2;
    const sy = obj.target.y - game.camera.y + h / 2;
    if (sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30) return;
    const ang = Math.atan2(sy - h / 2, sx - w / 2);
    const ex = Math.max(34, Math.min(w - 34, w / 2 + Math.cos(ang) * (w / 2 - 20)));
    const ey = Math.max(34, Math.min(h - 34, h / 2 + Math.sin(ang) * (h / 2 - 20)));
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(-8, -8);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,233,168,0.85)';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    const metres = Math.round(Math.hypot(p.x - obj.target.x, p.y - obj.target.y) / 10);
    ctx.fillText(`${metres}m`, ex, ey + 24);
  }

  drawObjective(ctx, game, w) {
    // The stars live top-right whether or not a job is running, with a
    // quiet line under them when heat is rising but no star has landed.
    const stars = game.wanted.stars;
    ctx.textAlign = 'right';
    ctx.font = `26px ${FONT}`;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < stars ? '#ffd166' : 'rgba(232, 227, 216, 0.25)';
      ctx.fillText('★', w - 18 - (4 - i) * 30, 44);
    }
    if (game.wanted.heat > 0 && stars === 0) {
      ctx.fillStyle = 'rgba(232,227,216,0.6)';
      ctx.font = `11px ${FONT}`;
      ctx.fillText('the SHD is watching…', w - 18, 64);
    }
    // Under the stars, a hairline of gold: how full the next star is. It
    // turns "the SHD is watching…" into something a driver can budget by.
    if (game.wanted.heat > 0) {
      const frac = (game.wanted.heat % HEAT_PER_STAR) / HEAT_PER_STAR;
      ctx.fillStyle = 'rgba(232,227,216,0.18)';
      ctx.fillRect(w - 156, 52, 138, 4);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.85)';
      ctx.fillRect(w - 156, 52, 138 * (stars >= 5 ? 1 : frac), 4);
    }
    const obj = game.missions.objective(game);
    if (!obj) return;
    let dist = '';
    if (obj.target) {
      const p = game.player.car ?? game.player;
      dist = ` — ${Math.round(Math.hypot(p.x - obj.target.x, p.y - obj.target.y) / 10)}m`;
    }
    const timer = obj.timer !== null && obj.timer !== undefined ? `  ⏱ ${Math.max(0, Math.ceil(obj.timer))}s` : '';
    ctx.font = `bold 15px ${FONT}`;
    const text = `◆ ${obj.text}${dist}${timer}`;
    const tw = ctx.measureText(text).width + 28;
    panel(ctx, (w - tw) / 2, 14, tw, 34, 0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(text, w / 2, 37);
  }

  drawMinimap(ctx, game, w, h) {
    const MW = 188;
    const MH = 138;
    const x0 = w - MW - 14;
    const y0 = h - MH - 14;
    const s = Math.min(MW / WORLD_W, MH / WORLD_H);
    panel(ctx, x0 - 4, y0 - 4, MW + 8, MH + 8, 0.6);
    // The district Leo is standing in, named above the map.
    const lp = game.player.car ?? game.player;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(244,241,222,0.85)';
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText(districtNameAt(game.city, lp.x, lp.y).toUpperCase(), x0 + MW, y0 - 10);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0, y0, MW, MH, 8);
    ctx.clip();
    ctx.fillStyle = '#79a85b';
    ctx.fillRect(x0, y0, MW, MH);
    const px = (wx) => x0 + wx * s;
    const py = (wy) => y0 + wy * s;
    // Sand first, then the sea east of the shore line.
    ctx.fillStyle = '#eed9a4';
    ctx.fillRect(px(game.city.shoreX - 250), y0, MW, MH);
    ctx.fillStyle = '#2e8fa3';
    ctx.fillRect(px(game.city.shoreX), y0, MW, MH);
    // The road grid, thick enough to read at a glance — drawn off the
    // same centre-line helpers the world itself uses, so map and city
    // can never disagree.
    ctx.strokeStyle = '#3d4148';
    ctx.lineWidth = Math.max(1.4, 96 * s);
    for (let c = 0; c <= 9; c += 1) {
      ctx.beginPath();
      ctx.moveTo(px(roadCenterX(c)), y0);
      ctx.lineTo(px(roadCenterX(c)), y0 + MH);
      ctx.stroke();
    }
    for (let r = 0; r <= 7; r += 1) {
      ctx.beginPath();
      ctx.moveTo(x0, py(roadCenterY(r)));
      ctx.lineTo(x0 + MW, py(roadCenterY(r)));
      ctx.stroke();
    }
    // Traffic as faint dots; the law as badges that flash red and blue.
    ctx.fillStyle = 'rgba(240,240,240,0.5)';
    for (const driver of game.trafficDrivers) {
      ctx.fillRect(px(driver.car.x) - 1, py(driver.car.y) - 1, 2, 2);
    }
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    for (const car of game.police.cars) {
      ctx.fillStyle = flash ? '#ef476f' : '#118ab2';
      ctx.beginPath();
      ctx.arc(px(car.x), py(car.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // The job, as a gold star; Leo, as a white arrow that turns with him.
    const obj = game.missions.objective(game);
    if (obj && obj.target) {
      ctx.fillStyle = '#ffd166';
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('★', px(obj.target.x), py(obj.target.y) + 4);
    }
    const p = game.player.car ?? game.player;
    ctx.translate(px(p.x), py(p.y));
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.4, 5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4.4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** The bust meter only exists while a bust is actually brewing — a red
   * bar under the objective, filling over the same seconds the SHD needs. */
  drawBustMeter(ctx, game, w) {
    const bustT = game.wanted.bustT;
    if (bustT <= 0.05) return;
    const bw = 240;
    panel(ctx, (w - bw) / 2, 58, bw, 30, 0.65);
    ctx.fillStyle = '#ef476f';
    ctx.fillRect((w - bw) / 2 + 8, 66, (bw - 16) * Math.min(1, bustT / BUST_TIME), 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd7de';
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('BUSTED?', w / 2, 84);
  }

  drawBanner(ctx, game, w, h) {
    const b = game.bannerState;
    const a = Math.min(1, b.t / 0.4, (b.total - b.t) / 0.4 + 0.2);
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.textAlign = 'center';
    ctx.fillStyle = b.color;
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillText(b.title, w / 2, h * 0.3);
    ctx.fillStyle = '#f4f1de';
    ctx.font = `18px ${FONT}`;
    ctx.fillText(b.sub, w / 2, h * 0.3 + 34);
    ctx.globalAlpha = 1;
  }

  drawDialogue(ctx, game, w, h) {
    const d = game.dialogue;
    const line = d.lines[d.index];
    if (!line) return;
    const bw = Math.min(680, w - 60);
    const x0 = (w - bw) / 2;
    const y0 = h - 128;
    panel(ctx, x0, y0, bw, 82, 0.78);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(line.who.toUpperCase(), x0 + 18, y0 + 26);
    ctx.fillStyle = '#f4f1de';
    ctx.font = `15px ${FONT}`;
    wrapText(ctx, line.text, x0 + 18, y0 + 48, bw - 36, 19);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(244,241,222,0.6)';
    ctx.font = `11px ${FONT}`;
    ctx.fillText('Enter ▸', x0 + bw - 14, y0 + 74);
  }

  drawPrompt(ctx, game, w, h) {
    ctx.font = `bold 15px ${FONT}`;
    const text = game.prompt;
    const tw = ctx.measureText(text).width + 30;
    panel(ctx, (w - tw) / 2, h - 190, tw, 32, 0.65);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(text, w / 2, h - 169);
  }
}

/** Greedy word wrap: fill a line until the next word would overflow it,
 * then start the next one lower. Returns nothing; draws as it goes. */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
