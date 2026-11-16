// HEARTSTAR — input: keyboard + mouse, in one place.
// One job: track what the player is pressing and where the mouse is,
// in canvas (logical 1280x720) coordinates. The world never reads DOM events.
import { VIEW } from './config.js';

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: VIEW.width / 2, y: VIEW.height / 2 - 160, down: false };
    this.canvas = canvas;
    this.onPress = null; // (code) => void, set by main.js for menu keys
    this._attach();
  }

  _attach() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        if (this.onPress) this.onPress(e.code);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * VIEW.width;
      this.mouse.y = ((e.clientY - rect.top) / rect.height) * VIEW.height;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.down = true;
        if (this.onPress) this.onPress('Mouse');
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Normalized WASD / arrow movement vector, {x, y}. */
  moveVec() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  get firing() {
    return this.mouse.down || this.keys.has('Space');
  }

  /** Aim angle from a point toward the mouse. */
  aimAngle(fromX, fromY) {
    return Math.atan2(this.mouse.y - fromY, this.mouse.x - fromX);
  }
}
