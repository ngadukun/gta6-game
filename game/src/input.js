// Keyboard and mouse state for the game loop: which keys are down right now,
// which were pressed this step (edge-triggered, for menus and one-shot actions),
// and where the mouse points in screen and world space.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;

    window.addEventListener('keydown', (event) => {
      if (!event.repeat) this.pressed.add(event.code);
      this.down.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => this.down.delete(event.code));
    window.addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
  }

  /** True while any of the given key codes is held. */
  held(...codes) {
    return codes.some((code) => this.down.has(code));
  }

  /** True only on the step a key went down. */
  tapped(...codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  /** The mouse position in world space, given the camera and the view size. */
  mouseWorld(camera, viewW, viewH) {
    return {
      x: this.mouseX - viewW / 2 + camera.x,
      y: this.mouseY - viewH / 2 + camera.y,
    };
  }

  /** Call once per simulation step, after every system has read the edges. */
  endStep() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
