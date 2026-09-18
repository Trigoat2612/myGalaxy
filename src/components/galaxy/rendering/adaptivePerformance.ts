export type AdaptivePerformanceTier = 'eco' | 'balanced' | 'quality';

export type AdaptivePerformanceSnapshot = {
  fps: number;
  tier: AdaptivePerformanceTier;
  renderScale: number;
  changed: boolean;
};

type AdaptivePerformanceOptions = {
  mobile: boolean;
  initialTier?: AdaptivePerformanceTier;
};

export const ADAPTIVE_RENDER_SCALE: Record<AdaptivePerformanceTier, number> = {
  eco: 0.78,
  balanced: 0.90,
  quality: 1,
};

const ORDER: AdaptivePerformanceTier[] = ['eco', 'balanced', 'quality'];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export class AdaptivePerformanceTracker {
  private readonly mobile: boolean;
  private tier: AdaptivePerformanceTier;
  private emaFps = 60;
  private lowFor = 0;
  private highFor = 0;
  private cooldown = 0;

  constructor({ mobile, initialTier = 'balanced' }: AdaptivePerformanceOptions) {
    this.mobile = mobile;
    this.tier = initialTier;
  }

  get currentTier() {
    return this.tier;
  }

  get currentFps() {
    return this.emaFps;
  }

  update(delta: number, locked = false): AdaptivePerformanceSnapshot {
    const safeDelta = clamp(delta, 1 / 240, 0.1);
    const instantFps = 1 / safeDelta;
    const smoothing = 1 - Math.exp(-safeDelta * 2.4);
    this.emaFps += (instantFps - this.emaFps) * smoothing;
    this.cooldown = Math.max(0, this.cooldown - safeDelta);

    if (locked) {
      this.lowFor = 0;
      this.highFor = 0;
      return this.snapshot(false);
    }

    const lowThreshold = this.mobile ? 38 : 46;
    const highThreshold = this.mobile ? 53 : 57;

    if (this.emaFps < lowThreshold) {
      this.lowFor += safeDelta;
      this.highFor = Math.max(0, this.highFor - safeDelta * 2);
    } else if (this.emaFps > highThreshold) {
      this.highFor += safeDelta;
      this.lowFor = Math.max(0, this.lowFor - safeDelta * 2);
    } else {
      this.lowFor = Math.max(0, this.lowFor - safeDelta);
      this.highFor = Math.max(0, this.highFor - safeDelta);
    }

    if (this.cooldown > 0) return this.snapshot(false);

    if (this.lowFor >= 1.6) {
      this.lowFor = 0;
      this.highFor = 0;
      const current = ORDER.indexOf(this.tier);
      if (current > 0) {
        this.tier = ORDER[current - 1];
        this.cooldown = 3.2;
        return this.snapshot(true);
      }
    }

    if (this.highFor >= 4.5) {
      this.lowFor = 0;
      this.highFor = 0;
      const current = ORDER.indexOf(this.tier);
      if (current < ORDER.length - 1) {
        this.tier = ORDER[current + 1];
        this.cooldown = 5.0;
        return this.snapshot(true);
      }
    }

    return this.snapshot(false);
  }

  private snapshot(changed: boolean): AdaptivePerformanceSnapshot {
    return {
      fps: this.emaFps,
      tier: this.tier,
      renderScale: ADAPTIVE_RENDER_SCALE[this.tier],
      changed,
    };
  }
}
