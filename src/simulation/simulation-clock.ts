export type SimulationClockState = {
  utcMs: number;
  rate: number;
  paused: boolean;
};

export class SimulationClock {
  private state: SimulationClockState;
  private lastRealMs: number;

  constructor(initialUtcMs: number) {
    this.state = { utcMs: initialUtcMs, rate: 1, paused: false };
    this.lastRealMs = performance.now();
  }

  read(): SimulationClockState {
    const now = performance.now();
    if (!this.state.paused) {
      this.state.utcMs += (now - this.lastRealMs) * this.state.rate;
    }
    this.lastRealMs = now;
    return { ...this.state };
  }

  setTime(utcMs: number): void {
    this.state.utcMs = utcMs;
  }

  setRate(rate: number): void {
    this.read();
    this.state.rate = rate;
  }

  pause(): void {
    this.read();
    this.state.paused = true;
  }

  resume(): void {
    this.lastRealMs = performance.now();
    this.state.paused = false;
  }
}
