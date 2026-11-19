// Particles and floating text: the small violences and rewards of the street —
// muzzle sparks, crash dust, tyre smoke, and the green numbers that float up
// when money changes hands. One pool, updated and drawn by the renderer.

export class Effects {
  constructor() {
    this.parts = [];
    this.texts = [];
  }

  burst(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({
        x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
        life: life * (0.6 + Math.random() * 0.7), maxLife: life,
        color, size: 1.5 + Math.random() * 2.2, drag: 3, rise: 0,
      });
    }
  }

  smoke(x, y, dark) {
    this.parts.push({
      x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 14, vy: -22 - Math.random() * 16,
      life: 0.9 + Math.random() * 0.6, maxLife: 1.4,
      color: dark ? '#3a3f44' : '#c9ced4', size: 5 + Math.random() * 6, drag: 0.4, rise: 1, smoke: true,
    });
  }

  text(x, y, str, color) {
    this.texts.push({ x, y, str, color, life: 1.5 });
  }

  /** A soft grey puff for tyres at the limit — drifting, burning out. */
  tireSmoke(x, y) {
    if (this.parts.length > 420) return;
    this.parts.push({
      x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 14, vy: -8 - Math.random() * 10,
      life: 0.7, maxLife: 0.7,
      color: '#c8c8cd', size: 5 + Math.random() * 5, drag: 0.6, rise: 1, smoke: true,
    });
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-p.drag * dt);
      p.vy *= Math.exp(-p.drag * dt);
      if (p.rise) p.vy -= 12 * dt;
      if (p.smoke) p.size += 7 * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 26 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  /** Drawn in world space; the renderer sets the camera transform first. */
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
