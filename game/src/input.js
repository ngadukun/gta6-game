// input.js — hands and eyes: the keyboard and mouse, sampled by the loop.
//
// The loop asks two different questions — "is it down?" for walking and
// driving, and "did it just go down?" for menus, doors and other one-shot
// acts — so this class keeps a held set and a pressed-this-step set side
// by side, and spends the pressed set at the end of every step.

const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();     // codes currently held
    this.pressed = new Set();  // codes that went down since the last endStep
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false; // left button went down since the last endStep

    window.addEventListener('keydown', (event) => {
      if (!event.repeat) this.pressed.add(event.code);
      this.down.add(event.code);
      // The page must never scroll out from under the game.
      if (SCROLL_KEYS.includes(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.down.delete(event.code);
    });
    window.addEventListener('blur', () => {
      // Losing the window mid-hold must not leave a key — or worse, the
      // trigger — stuck down when the player comes back.
      this.reset();
    });
    window.addEventListener('visibilitychange', () => {
      // A hidden tab is a lost window by another name: same promise.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') this.reset();
    });
    canvas.addEventListener('mousemove', (event) => {
      const box = canvas.getBoundingClientRect();
      this.mouseX = event.clientX - box.left;
      this.mouseY = event.clientY - box.top;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
  }

  /** True while at least one of the given codes is held down. */
  held(...codes) {
    return codes.some((code) => this.down.has(code));
  }

  /** True only during the step in which one of the codes went down. */
  tapped(...codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  /** Where the mouse points in the world, through the camera. */
  mouseWorld(camera, viewW, viewH) {
    return {
      x: this.mouseX - viewW / 2 + camera.x,
      y: this.mouseY - viewH / 2 + camera.y,
    };
  }

  /** Forget everything at once: held keys, fresh presses, the trigger.
   * The window losing focus calls this, and so may the game itself —
   * pausing with a key down should never resume with it still down. */
  reset() {
    this.down.clear();
    this.pressed.clear();
    this.mouseDown = false;
    this.mouseClicked = false;
  }

  /** Close the step: edges are spent, held keys carry over. */
  endStep() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
