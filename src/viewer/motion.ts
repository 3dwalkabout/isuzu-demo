export const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** A reversible transition starts at its current value, even during rapid input. */
export class Transition {
  value: number;
  private from: number;
  private target: number;
  private started = 0;
  private duration: number;
  constructor(value: number, duration = 420) {
    this.duration = duration;
    this.value = this.from = this.target = value;
  }
  to(target: number, now: number, immediate = false) {
    this.update(now);
    if (!immediate && target === this.target) return;
    this.from = this.value;
    this.target = target;
    this.started = now;
    if (immediate) this.value = this.from = target;
  }
  update(now: number) {
    const t = Math.min(1, Math.max(0, (now - this.started) / this.duration));
    this.value = this.from + (this.target - this.from) * easeInOut(t);
    return this.value !== this.target;
  }
}
