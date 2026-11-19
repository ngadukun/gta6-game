// The HUD: everything nailed to the screen rather than the world — cash and
// health, the wanted stars, the current objective, weapon and vehicle panels,
// the bust meter, banners and dialogue, and the minimap that keeps Leo found.
import { WORLD_H, WORLD_W } from './config.js';
import { districtNameAt } from './city.js';

const FONT = 'system-ui, -apple-system, sans-serif';

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
    // Health: Leo's on foot, his car's while driving.
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
      ctx.fillText(`${game.player.car.type.name}  ·  ${kmh} km/h`, 26, 76 - 2);
    } else {
      ctx.fillText('ON FOOT', 26, 76 - 2);
    }
  }

  /** The pistol, bottom-left: twelve pips for the magazine, the reserve
   * count, and a plain warning while a reload is running. */
  drawWeapon(ctx, game, h) {
    const c = game.combat;
    panel(ctx, 14, h - 58, 218, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8e3d8';
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillText('PISTOL', 26, h - 32);
    for (let i = 0; i < 12; i += 1) {
      ctx.fillStyle = i < c.mag ? '#ffd166' : 'rgba(232,227,216,0.22)';
      ctx.beginPath();
      ctx.arc(76 + i * 11, h - 36, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = c.reloadT > 0 ? '#ef476f' : 'rgba(232,227,216,0.75)';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(c.reloadT > 0 ? 'RELOADING…' : `reserve ${c.reserve}`, 76, h - 21);
  }

  /** When the objective is off-screen, a gold arrow rides the screen edge
   * and points the way — nobody should lose a job to a minimap dot. */
  drawEdgeArrow(ctx, game, w, h) {
    const obj = game.missions.objective(game);
    if (!obj || !obj.target) return;
    const p = game.player.car ?? game.player;
    const sx = obj.target.x - game.camera.x + w / 2;
    const sy = obj.target.y - game.camera.y + h / 2;
    if (sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30) return;   // on screen already
    const ang = Math.atan2(sy - h / 2, sx - w / 2);
    const ex = Math.max(34, Math.min(w - 34, w / 2 + Math.cos(ang) * (w / 2 - 20)));
    const ey = Math.max(34, Math.min(h - 34, h / 2 + Math.sin(ang) * (h / 2 - 20)));
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(13, 0); ctx.lineTo(-8, -8); ctx.lineTo(-3, 0); ctx.lineTo(-8, 8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,233,168,0.85)';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(Math.hypot(p.x - obj.target.x, p.y - obj.target.y) / 10)}m`, ex, ey + 24);
  }

  drawObjective(ctx, game, w) {
    const obj = game.missions.objective(game);
    // Wanted stars, top-right, whether or not a job is running.
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
    if (!obj) return;
    const target = obj.target;
    let dist = '';
    if (target) {
      const p = game.player.car ?? game.player;
      dist = ` — ${Math.round(Math.hypot(p.x - target.x, p.y - target.y) / 10)}m`;
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
    // Sand and sea.
    ctx.fillStyle = '#eed9a4';
    ctx.fillRect(px(game.city.shoreX - 250), y0, MW, MH);
    ctx.fillStyle = '#2e8fa3';
    ctx.fillRect(px(game.city.shoreX), y0, MW, MH);
    // Roads.
    ctx.strokeStyle = '#3d4148';
    ctx.lineWidth = Math.max(1.4, 96 * s);
    for (let c = 0; c <= 9; c += 1) {
      ctx.beginPath(); ctx.moveTo(px(c * 384 + 48), y0); ctx.lineTo(px(c * 384 + 48), y0 + MH); ctx.stroke();
    }
    for (let r = 0; r <= 7; r += 1) {
      ctx.beginPath(); ctx.moveTo(x0, py(r * 384 + 48)); ctx.lineTo(x0 + MW, py(r * 384 + 48)); ctx.stroke();
    }
    // Traffic as faint dots, police as flashing badges, the objective as a star.
    ctx.fillStyle = 'rgba(240,240,240,0.5)';
    for (const car of game.trafficDrivers) {
      ctx.fillRect(px(car.car.x) - 1, py(car.car.y) - 1, 2, 2);
    }
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    for (const car of game.police.cars) {
      ctx.fillStyle = flash ? '#ef476f' : '#118ab2';
      ctx.beginPath(); ctx.arc(px(car.x), py(car.y), 3, 0, Math.PI * 2); ctx.fill();
    }
    const obj = game.missions.objective(game);
    if (obj && obj.target) {
      ctx.fillStyle = '#ffd166';
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('★', px(obj.target.x), py(obj.target.y) + 4);
    }
    // Leo: a white arrow that turns with him.
    const p = game.player.car ?? game.player;
    ctx.translate(px(p.x), py(p.y));
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(0, 2.4); ctx.lineTo(-4.4, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawBustMeter(ctx, game, w) {
    const bustT = game.wanted.bustT;
    if (bustT <= 0.05) return;
    const bw = 240;
    panel(ctx, (w - bw) / 2, 58, bw, 30, 0.65);
    ctx.fillStyle = '#ef476f';
    ctx.fillRect((w - bw) / 2 + 8, 66, (bw - 16) * Math.min(1, bustT / 2.4), 6);
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

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
