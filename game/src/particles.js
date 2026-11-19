// The small weather of the street: muzzle sparks, plaster dust, tyre smoke
// at the limit, engine smoke over a dying car, and the green numbers that
// drift up off the pavement when money changes hands. One pool for all of
// it, updated here and drawn by whoever owns the canvas.

export class Effects {
  constructor() {
    this.parts = [];
    this.texts = [];
  }

  /** Keep the pools bounded no matter how violent the minute gets: past
   * the cap, the oldest particles are retired early. A long gunfight in a
   * traffic jam should never be allowed to eat the frame rate. */
  trim() {
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    if (this.texts.length > 24) this.texts.splice(0, this.texts.length - 24);
  }

  /** A quick spray of sparks or dust from a point. */
  burst(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      const maxLife = life;
      this.parts.push({
        x, y,
        vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: maxLife * (0.6 + Math.random() * 0.7), maxLife,
        color, size: 1.5 + Math.random() * 2.2, drag: 3, rise: 0,
      });
    }
  }

  /** A rising puff off a hot engine — pale while the car limps, dark when
   * it is nearly done. */
  smoke(x, y, dark) {
    this.parts.push({
      x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 14, vy: -22 - Math.random() * 16,
      life: 0.9 + Math.random() * 0.6, maxLife: 1.4,
      color: dark ? '#3a3f44' : '#c9ced4', size: 5 + Math.random() * 6,
      drag: 0.4, rise: 1, smoke: true,
    });
  }

  /** A soft grey breath from the rear tyres — drifting, or a burnout. The
   * pool is capped: a long slide should not be allowed to eat the frame. */
  tireSmoke(x, y) {
    if (this.parts.length > 420) return;
    this.parts.push({
      x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 14, vy: -8 - Math.random() * 10,
      life: 0.7, maxLife: 0.7,
      color: '#c8c8cd', size: 5 + Math.random() * 5,
      drag: 0.6, rise: 1, smoke: true,
    });
  }

  /** Floating words: "+$300", "AMMO +36" — the street's bookkeeping. */
  text(x, y, str, color) {
    this.texts.push({ x, y, str, color, life: 1.5 });
  }

  update(dt) {
    this.trim();
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const dragK = Math.exp(-p.drag * dt);
      p.vx *= dragK;
      p.vy *= dragK;
      if (p.rise) p.vy -= 12 * dt;      // smoke climbs as it thins
      if (p.smoke) p.size += 7 * dt;    // …and spreads as it climbs
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 26 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  /** Drawn in world space — the caller sets the camera transform first. */
  draw(ctx) {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = p.smoke ? a * 0.4 : a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
