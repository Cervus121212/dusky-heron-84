// Keyboard + mouse input for COSTA LUNA.
// State lives on G.keys (keyed by event.code). The camera drag writes into G.cam
// through callbacks the main loop installs; this module only owns the listeners.

export function buildInput(G) {
  const input = {
    dragDX: 0,
    dragDY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    clicked: false,

    attach(canvas) {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') e.preventDefault();
        G.keys[e.code] = true;
        if (e.code === 'Enter' && G.state === 'title') G.startGame();
      });
      window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });
      window.addEventListener('blur', () => { G.keys = {}; });
      canvas.addEventListener('mousedown', (e) => {
        this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
        this.clicked = true;
      });
      window.addEventListener('mouseup', () => { this.dragging = false; });
      window.addEventListener('mousemove', (e) => {
        if (!this.dragging) return;
        this.dragDX += e.clientX - this.lastX;
        this.dragDY += e.clientY - this.lastY;
        this.lastX = e.clientX; this.lastY = e.clientY;
      });
      canvas.addEventListener('wheel', (e) => {
        G.cam.zoom = Math.max(-4, Math.min(6, (G.cam.zoom || 0) + (e.deltaY > 0 ? 1 : -1)));
      }, { passive: true });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },

    // Consumed once per frame by the camera: pixels dragged since last read.
    takeDrag() {
      const d = { x: this.dragDX, y: this.dragDY };
      this.dragDX = 0; this.dragDY = 0;
      return d;
    },

    takeClick() {
      const c = this.clicked;
      this.clicked = false;
      return c;
    },

    // Edge-triggered keys: true once per physical press.
    pressed(code) {
      if (G.keys[code] && !G._prevKeys[code]) { G._prevKeys[code] = true; return true; }
      if (!G.keys[code]) G._prevKeys[code] = false;
      return false;
    },
  };
  return input;
}
