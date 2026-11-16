// Reloj de simulación: solo mueve el índice t; simulate() ya calculó todo el horizonte.
// Estados: reset → running ⇄ paused → done (README-handoff §5).

export class Runner {
  constructor({ horizon, tickMs = 300, speed = 1, onChange = () => {} }) {
    this.horizon = horizon;
    this.tickMs = tickMs;
    this.speed = speed; // 0 = paso a paso
    this.state = 'reset';
    this.t = 0;
    this.onChange = onChange;
    this.timer = null;
  }

  emit(stateChanged) { this.onChange({ t: this.t, state: this.state, stateChanged }); }

  setState(s) {
    const changed = s !== this.state;
    this.state = s;
    this.emit(changed);
  }

  clear() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  /** Botón principal: Iniciar / Pausar / Continuar / Repetir. */
  primary() {
    if (this.state === 'running') return this.pause();
    if (this.state === 'done') { this.t = 0; }
    if (this.speed === 0) return this.step();
    return this.run();
  }

  get primaryLabel() {
    if (this.state === 'running') return 'Pausar';
    if (this.state === 'done') return 'Repetir';
    if (this.state === 'paused') return 'Continuar';
    return 'Iniciar';
  }

  run() {
    this.clear();
    if (this.t >= this.horizon) this.t = 0;
    this.timer = setInterval(() => this.tick(), Math.max(16, this.tickMs / (this.speed || 1)));
    this.setState('running');
  }

  tick() {
    this.t = Math.min(this.horizon, this.t + 1);
    if (this.t >= this.horizon) { this.clear(); this.setState('done'); }
    else this.emit(false);
  }

  pause() {
    this.clear();
    this.setState('paused');
  }

  step() {
    this.clear();
    if (this.state === 'done' || this.t >= this.horizon) this.t = 0;
    this.t = Math.min(this.horizon, this.t + 1);
    this.setState(this.t >= this.horizon ? 'done' : 'paused');
  }

  reset() {
    this.clear();
    this.t = 0;
    this.setState('reset');
  }

  setSpeed(speed) {
    this.speed = speed;
    if (this.state === 'running') {
      if (speed === 0) this.pause();
      else this.run();
    }
  }

  setHorizon(h) {
    this.horizon = h;
    if (this.t > h) this.t = h;
  }

  destroy() { this.clear(); this.onChange = () => {}; }
}
