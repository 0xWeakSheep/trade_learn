/**
 * Preset configurations for different market conditions
 */

export const AS_PRESETS = {
  /**
   * Conservative preset - wider spreads, more inventory targeting
   * Good for: Low liquidity, volatile markets
   */
  conservative: {
    gamma: 1.0,
    maxSpreadMultiplier: 4.0,
    minSpread: 0.02,
    updateIntervalMs: 2000,
  },

  /**
   * Moderate preset - balanced approach
   * Good for: Normal market conditions
   */
  moderate: {
    gamma: 0.5,
    maxSpreadMultiplier: 3.0,
    minSpread: 0.01,
    updateIntervalMs: 1000,
  },

  /**
   * Aggressive preset - tighter spreads, less inventory targeting
   * Good for: High liquidity, stable markets
   */
  aggressive: {
    gamma: 0.1,
    maxSpreadMultiplier: 2.0,
    minSpread: 0.005,
    updateIntervalMs: 500,
  },
} as const;

export type ASPreset = keyof typeof AS_PRESETS;
