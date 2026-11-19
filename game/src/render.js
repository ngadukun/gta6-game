// The renderer: Sunhaven from above in late-afternoon light. Grass and
// pavement, pastel blocks under long shadows, the beach running down to a
// foam-edged sea, then the people and the cars on top of it all. And the
// game's full-screen faces — title, pause, busted, wasted, and the morning
// after the big one — drawn over the living city.
import { BLOCK, CITY_W, COLS, PITCH, ROAD_W, ROWS, WORLD_H, WORLD_W } from './config.js';

const FONT = 'system-ui, -apple-system, sans-serif';

export class Renderer {
  drawWorld(ctx, game, w, h) {
    const cam = game.camera;
    ctx.fillStyle = '#22707f';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 - cam.x, h / 2 - cam.y);
    const view = { x: cam.x - w / 2 - 80, y: cam.y - h / 2 - 80, w: w + 160, h: h + 160 };

    this.drawGround(ctx, game, view);
    this.drawRoads(ctx, game);
    this.drawBeacon(ctx, game);
    // Small props are culled against the view like the buildings are: the
    // city holds hundreds of them and the camera only ever sees a street.
    for (const lamp of game.city.lamps) if (nearView(lamp.x, lamp.y, view, 24)) this.drawLamp(ctx, lamp);
    for (const pk of game.pickups) if (pk.active && nearView(pk.x, pk.y, view, 24)) this.drawPickup(ctx, pk);
    for (const crate of game.city.crates) if (!crate.dead && nearView(crate.x + crate.s / 2, crate.y + crate.s / 2, view, 40)) this.drawCrate(ctx, crate);
    for (const palm of game.city.palms) if (nearView(palm.x, palm.y, view, 40)) this.drawPalm(ctx, palm);
    for (const b of game.city.buildings) if (overlaps(b, view)) this.drawBuilding(ctx, b);
    for (const ped of game.peds) this.drawPed(ctx, ped);
    for (const car of game.allCars()) this.drawCar(ctx, car, game);
    if (!game.player.car) this.drawPlayer(ctx, game.player);
    this.drawBullets(ctx, game);
    game.effects.draw(ctx);
    ctx.restore();

    // A warm vignette over the whole frame: the light in Sunhaven is
    // always about an hour from evening.
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.78);
    grad.addColorStop(0, 'rgba(255, 190, 90, 0)');
    grad.addColorStop(1, 'rgba(120, 50, 10, 0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  drawGround(ctx, game, view) {
    const city = game.city;
    ctx.fillStyle = '#79a85b';
    ctx.fillRect(0, 0, CITY_W, WORLD_H);
    // Mow stripes: the parks department works in bands.
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let x = 0; x < CITY_W; x += 128) {
      if ((x / 128) % 2 === 0) ctx.fillRect(x, 0, 64, WORLD_H);
    }
    // Sand, then sea, with a foam line that wanders along the shore.
    ctx.fillStyle = '#eed9a4';
    ctx.fillRect(CITY_W, 0, city.shoreX - CITY_W + 46, WORLD_H);
    ctx.fillStyle = '#2e8fa3';
    ctx.fillRect(city.shoreX, 0, WORLD_W - city.shoreX + 200, WORLD_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let y = 0; y <= WORLD_H; y += 26) {
      const xx = city.shoreX + Math.sin(y * 0.05) * 5;
      if (y === 0) ctx.moveTo(xx, y);
      else ctx.lineTo(xx, y);
    }
    ctx.stroke();
    // Every block wears a pavement apron over its lawn.
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const bx = col * PITCH + ROAD_W;
        const by = row * PITCH + ROAD_W;
        ctx.fillStyle = '#cfc4ae';
        ctx.fillRect(bx - 13, by - 13, BLOCK + 26, BLOCK + 26);
        ctx.fillStyle = '#6d9c52';
        ctx.fillRect(bx, by, BLOCK, BLOCK);
      }
    }
  }

  drawRoads(ctx, game) {
    ctx.fillStyle = '#3d4148';
    for (let c = 0; c <= COLS; c += 1) ctx.fillRect(c * PITCH, 0, ROAD_W, WORLD_H);
    for (let r = 0; r <= ROWS; r += 1) ctx.fillRect(0, r * PITCH, CITY_W + ROAD_W, ROAD_W);
    // Centre dashes, worn gold.
    ctx.fillStyle = '#e8c85a';
    for (let c = 0; c <= COLS; c += 1) {
      for (let y = 10; y < WORLD_H; y += 44) ctx.fillRect(c * PITCH + ROAD_W / 2 - 2, y, 4, 24);
    }
    for (let r = 0; r <= ROWS; r += 1) {
      for (let x = 10; x < CITY_W; x += 44) ctx.fillRect(x, r * PITCH + ROAD_W / 2 - 2, 24, 4);
    }
    // Crosswalks: four bars of stripes on every approach to every crossing.
    ctx.fillStyle = 'rgba(232,227,216,0.5)';
    for (let c = 0; c <= COLS; c += 1) {
      for (let r = 0; r <= ROWS; r += 1) {
        const cx = c * PITCH;
        const cy = r * PITCH;
        for (let i = 0; i < 4; i += 1) {
          ctx.fillRect(cx + 12 + i * 20, cy - 9, 11, 5);
          ctx.fillRect(cx + 12 + i * 20, cy + ROAD_W + 4, 11, 5);
          ctx.fillRect(cx - 9, cy + 12 + i * 20, 5, 11);
          ctx.fillRect(cx + ROAD_W + 4, cy + 12 + i * 20, 5, 11);
        }
      }
    }
  }

  drawLamp(ctx, lamp) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(lamp.x + 2, lamp.y + 3, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5c6670';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  /** An ammo box on a friendly porch, bobbing gently so the eye finds it. */
  drawPickup(ctx, pk) {
    const bob = Math.sin(performance.now() / 300 + pk.x) * 2.4;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 8 - bob, 11, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f6212';
    ctx.beginPath();
    ctx.roundRect(-10, -7, 20, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-10, -2, 20, 4);
    ctx.fillStyle = '#f4f1de';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', 0, -10);
    ctx.restore();
  }

  /** The objective beacon: a column of gold light with a breathing ring at
   * its foot, visible across half the city. It is meant to be followed. */
  drawBeacon(ctx, game) {
    const obj = game.missions.objective(game);
    if (!obj || !obj.target) return;
    const t = performance.now() / 1000;
    const pulse = 0.65 + Math.sin(t * 4) * 0.2;
    const { x, y } = obj.target;
    const grad = ctx.createLinearGradient(0, y - 300, 0, y);
    grad.addColorStop(0, 'rgba(255, 209, 102, 0)');
    grad.addColorStop(1, `rgba(255, 209, 102, ${0.35 * pulse})`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - 13, y - 300, 26, 300);
    ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, 30 + Math.sin(t * 4) * 5, 13 + Math.sin(t * 4) * 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawCrate(ctx, crate) {
    ctx.fillStyle = '#9c6644';
    ctx.fillRect(crate.x, crate.y, crate.s, crate.s);
    ctx.strokeStyle = '#6f452b';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x + 1, crate.y + 1, crate.s - 2, crate.s - 2);
    ctx.beginPath();
    ctx.moveTo(crate.x, crate.y);
    ctx.lineTo(crate.x + crate.s, crate.y + crate.s);
    ctx.moveTo(crate.x + crate.s, crate.y);
    ctx.lineTo(crate.x, crate.y + crate.s);
    ctx.stroke();
  }

  drawPalm(ctx, palm) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(palm.x + 7, palm.y + 9, 15, 6, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6d4b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(palm.x - 4, palm.y + 5);
    ctx.lineTo(palm.x, palm.y);
    ctx.stroke();
    ctx.fillStyle = '#3f9142';
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + palm.x * 0.01;
      ctx.beginPath();
      ctx.ellipse(palm.x + Math.cos(a) * 9, palm.y + Math.sin(a) * 9, 10, 3.6, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBuilding(ctx, b) {
    const lift = b.height * 0.42;
    // The shadow goes south-east, the way the low sun throws it.
    ctx.fillStyle = 'rgba(30, 30, 20, 0.25)';
    ctx.fillRect(b.x + b.height * 0.3, b.y + b.height * 0.24, b.w, b.h);
    // Wall first, then the roof, lifted toward the viewer by the height.
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - lift * 0.3, b.y - lift, b.w, b.h);
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - lift * 0.3, b.y - lift, b.w, b.h);
    // One piece of rooftop clutter — a tank, an AC box — placed by the
    // building's own measurements, so it never repeats quite the same way.
    ctx.fillStyle = 'rgba(90, 80, 70, 0.5)';
    const rx = b.x - lift * 0.3 + (b.w % 37);
    const ry = b.y - lift + (b.h % 29);
    ctx.fillRect(rx, ry, Math.min(22, b.w * 0.24), Math.min(16, b.h * 0.2));
  }

  drawCar(ctx, car, game) {
    const t = car.type;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow, then wheels, then the body over both.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(3, 5, t.w * 0.55, t.h * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#15181c';
    const wheels = [[-t.w * 0.32, -t.h * 0.52], [t.w * 0.32, -t.h * 0.52], [-t.w * 0.32, t.h * 0.52], [t.w * 0.32, t.h * 0.52]];
    for (const [wx, wy] of wheels) ctx.fillRect(wx - 5, wy - 2.6, 10, 5.2);
    ctx.fillStyle = car.dead ? '#2f3338' : car.color;
    ctx.beginPath();
    ctx.roundRect(-t.w / 2, -t.h / 2, t.w, t.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (car.isPolice) {
      // The SHD livery: a dark spine, and the light bar doing its two-tone.
      ctx.fillStyle = '#20242a';
      ctx.fillRect(-t.w * 0.08, -t.h / 2, t.w * 0.2, t.h);
      const flash = Math.floor(performance.now() / 240) % 2 === 0;
      ctx.fillStyle = flash ? '#ef476f' : '#5a1f2b';
      ctx.fillRect(-4, -t.h * 0.3, 8, t.h * 0.28);
      ctx.fillStyle = flash ? '#274b63' : '#118ab2';
      ctx.fillRect(-4, t.h * 0.02, 8, t.h * 0.28);
    } else {
      // Cabin glass, and a pale streak where the windscreen catches light.
      ctx.fillStyle = 'rgba(24, 34, 44, 0.85)';
      ctx.beginPath();
      ctx.roundRect(-t.w * 0.16, -t.h * 0.36, t.w * 0.36, t.h * 0.72, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 210, 235, 0.5)';
      ctx.fillRect(t.w * 0.13, -t.h * 0.32, t.w * 0.07, t.h * 0.64);
    }
    if (car.brakeLight) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-t.w / 2 - 1.6, -t.h * 0.34, 3, 4.6);
      ctx.fillRect(-t.w / 2 - 1.6, t.h * 0.34 - 4.6, 3, 4.6);
    }
    // The armoured Pony wears its plating outside: two steel bands, a gold
    // stripe, and rivets you could count at a red light.
    if (car.armored) {
      ctx.fillStyle = 'rgba(38, 44, 52, 0.85)';
      ctx.fillRect(-t.w * 0.3, -t.h / 2, t.w * 0.14, t.h);
      ctx.fillRect(t.w * 0.22, -t.h / 2, t.w * 0.12, t.h);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-t.w / 2, -1.4, t.w, 2.8);
      ctx.fillStyle = 'rgba(220,228,238,0.9)';
      for (const rx of [-0.3, 0.22]) {
        for (const ry of [-0.32, 0, 0.32]) {
          ctx.beginPath();
          ctx.arc(t.w * rx + 3, t.h * ry, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Headlights, on in spirit if not in fact.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(t.w / 2 - 1.4, -t.h * 0.36, 2.6, 4.4);
    ctx.fillRect(t.w / 2 - 1.4, t.h * 0.36 - 4.4, 2.6, 4.4);
    ctx.restore();

    // A passenger's head beside the driver's, when Paco is riding along.
    if (game.passenger && car === game.player.car) {
      ctx.fillStyle = '#e0ac69';
      ctx.beginPath();
      ctx.arc(car.x + 6, car.y - 5, 4.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPed(ctx, ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      // Flat on the pavement: an ellipse for the body, a head at the end.
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(12, 0, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(1.6, 2.6, 7.6, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Two feet, trading places at the walk cycle's pace.
    const bob = Math.sin(ped.walkCycle) * 2.2;
    ctx.fillStyle = '#2d3142';
    ctx.beginPath();
    ctx.arc(-2.6 + bob * 0.4, 3.4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2.6 - bob * 0.4, 3.4, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 6.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(0, -1, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(1.6, 2.8, 8.4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = player.moving ? Math.sin(player.walkCycle) * 2.4 : 0;
    ctx.fillStyle = '#22303c';
    ctx.beginPath();
    ctx.arc(-2.8 + bob * 0.4, 3.6, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2.8 - bob * 0.4, 3.6, 2.8, 0, Math.PI * 2);
    ctx.fill();
    // Leo himself: the teal jacket, and the red cap he never takes off.
    ctx.fillStyle = '#0e7c86';
    ctx.beginPath();
    ctx.arc(0, 0, 7.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(0, -1, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d64541';
    ctx.beginPath();
    ctx.arc(0, -2.6, 4.8, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBullets(ctx, game) {
    // A tracer: a short line trailing each round, the length of one tick
    // of its own flight.
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    for (const b of game.combat.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawTitle(ctx, game, w, h) {
    this.drawWorld(ctx, game, w, h);
    // A dusk gradient laid over the living city, darker at both ends.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(13, 20, 32, 0.55)');
    grad.addColorStop(0.55, 'rgba(13, 20, 32, 0.25)');
    grad.addColorStop(1, 'rgba(13, 20, 32, 0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = `bold 92px ${FONT}`;
    ctx.fillText('SUNHAVEN', w / 2, h * 0.3);
    ctx.fillStyle = '#f4f1de';
    ctx.font = `20px ${FONT}`;
    ctx.fillText('an open-world crime caper — one driver, one city, every badge in town', w / 2, h * 0.3 + 40);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = 'rgba(244, 241, 222, 0.9)';
    ctx.fillText('Leo Santos just rolled into Sunhaven with an empty tank and a borrowed name.', w / 2, h * 0.3 + 74);
    ctx.fillText('Marisol Vega at Vega Auto Works has work for a driver who does not ask questions.', w / 2, h * 0.3 + 96);

    const items = game.titleItems;
    ctx.font = `bold 22px ${FONT}`;
    items.forEach((item, i) => {
      const y = h * 0.58 + i * 40;
      ctx.fillStyle = i === game.titleIndex ? '#ffd166' : 'rgba(244,241,222,0.75)';
      ctx.fillText(`${i === game.titleIndex ? '▸ ' : ''}${item}`, w / 2, y);
    });
    ctx.font = `13.5px ${FONT}`;
    ctx.fillStyle = 'rgba(244, 241, 222, 0.75)';
    ctx.fillText('WASD drive & walk · F enter/exit car · mouse aim, click shoot · R reload · Shift sprint · Space handbrake · P pause · M mute', w / 2, h - 30);
  }

  drawOverlay(ctx, game, w, h) {
    const kind = game.screen;
    // Each ending gets its own weather: blue for the law, red for the
    // hospital, green-gold for the morning the city became Leo's.
    const washes = { busted: 'rgba(20, 30, 80, 0.55)', wasted: 'rgba(80, 8, 16, 0.55)', complete: 'rgba(10, 24, 18, 0.6)', paused: 'rgba(10, 24, 18, 0.6)' };
    ctx.fillStyle = washes[kind] ?? 'rgba(10, 24, 18, 0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    const titles = { busted: 'BUSTED', wasted: 'WASTED', complete: 'SUNHAVEN IS YOURS', paused: 'PAUSED' };
    const subs = {
      busted: 'The SHD impounds your pride. You pay $150 in “fees” and walk out at dawn. — Enter to continue',
      wasted: 'You wake up at St. Palma Hospital. The bill is $200 and the nurses judge you. — Enter to continue',
      complete: 'Story complete — Marisol’s last job is done. The city stays open: side work, scores and sunsets. — Enter to keep driving',
      paused: 'Enter or P to resume',
    };
    ctx.fillStyle = kind === 'complete' ? '#ffd166' : '#f4f1de';
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText(titles[kind] ?? '', w / 2, h * 0.44);
    ctx.font = `17px ${FONT}`;
    ctx.fillStyle = 'rgba(244, 241, 222, 0.92)';
    ctx.fillText(subs[kind] ?? '', w / 2, h * 0.44 + 42);
    if (kind === 'complete') {
      ctx.font = `15px ${FONT}`;
      ctx.fillText(`Cash earned on jobs: $${game.stats.earned.toLocaleString('en-US')} · Jobs done: ${game.stats.jobs} · Cars stolen: ${game.stats.stolen}`, w / 2, h * 0.44 + 74);
      ctx.fillText(`Shots fired along the way: ${game.stats.shots ?? 0}`, w / 2, h * 0.44 + 98);
    }
  }
}

/** Rectangle overlap, for culling buildings against the camera's view. */
function overlaps(b, view) {
  return b.x + b.w > view.x && b.x < view.x + view.w && b.y + b.h > view.y && b.y < view.y + view.h;
}

/** Point-with-margin overlap, for culling the small props the same way. */
function nearView(x, y, view, pad) {
  return x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
}
