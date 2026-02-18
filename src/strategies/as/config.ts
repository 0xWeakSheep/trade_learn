/**
 * Avellaneda-Stoikov Strategy Configuration
 *
 * Default configuration and configuration builder
 */
import { ASConfig } from './types.js';

/**
 * Default AS strategy configuration
 */
export const DEFAULT_AS_CONFIG: Partial<ASConfig> = {
  // Model parameters
  gamma: 0.5,

  // Order management
  maxSpreadMultiplier: 3.0,
  minSpread: 0.01,

  // Inventory management
  targetInventory: 0,

  // Execution
  updateIntervalMs: 1000,
  volatilityWindow: 100,
  kappaWindow: 50,

  // Safety
  dryRun: true,
  stopLossThreshold: -1000,
};

/**
 * Create AS configuration with defaults
 */
export function createASConfig(config: Partial<ASConfig>): ASConfig {
  // Extract base and quote assets from symbol
  const symbol = config.symbol || 'BTCUSDT';
  const baseAsset = config.baseAsset || symbol.replace(/USDT|BUSD|USDC$/, '');
  const quoteAsset = config.quoteAsset || 'USDT';

  return {
    // Required fields with defaults
    name: config.name || `AS-${symbol}`,
    symbol,
    baseAsset,
    quoteAsset,
    orderSize: config.orderSize || 0.001,
    maxPosition: config.maxPosition || 0.1,
    minPosition: config.minPosition || -0.1,
    tickSize: config.tickSize || 0.01,
    lotSize: config.lotSize || 0.0001,

    // Merge with defaults
    gamma: config.gamma ?? DEFAULT_AS_CONFIG.gamma!,
    maxSpreadMultiplier: config.maxSpreadMultiplier ?? DEFAULT_AS_CONFIG.maxSpreadMultiplier!,
    minSpread: config.minSpread ?? DEFAULT_AS_CONFIG.minSpread!,
    targetInventory: config.targetInventory ?? DEFAULT_AS_CONFIG.targetInventory!,
    updateIntervalMs: config.updateIntervalMs ?? DEFAULT_AS_CONFIG.updateIntervalMs!,
    volatilityWindow: config.volatilityWindow ?? DEFAULT_AS_CONFIG.volatilityWindow!,
    kappaWindow: config.kappaWindow ?? DEFAULT_AS_CONFIG.kappaWindow!,
    dryRun: config.dryRun ?? DEFAULT_AS_CONFIG.dryRun!,
    stopLossThreshold: config.stopLossThreshold ?? DEFAULT_AS_CONFIG.stopLossThreshold!,

    // Optional calculated fields
    kappa: config.kappa,
    sigma: config.sigma,
  };
}

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

/**
 * Create config from preset
 */
export function createASConfigFromPreset(
  preset: keyof typeof AS_PRESETS,
  overrides: Partial<ASConfig> = {}
): ASConfig {
  const presetConfig = AS_PRESETS[preset];
  return createASConfig({
    ...presetConfig,
    ...overrides,
  });
}

/**
 * Validate AS configuration
 */
export function validateASConfig(config: ASConfig): string[] {
  const errors: string[] = [];

  if (config.gamma <= 0) {
    errors.push('Gamma must be positive');
  }

  if (config.orderSize <= 0) {
    errors.push('Order size must be positive');
  }

  if (config.maxPosition <= 0) {
    errors.push('Max position must be positive');
  }

  if (config.minPosition >= 0) {
    errors.push('Min position must be negative');
  }

  if (config.tickSize <= 0) {
    errors.push('Tick size must be positive');
  }

  if (config.lotSize <= 0) {
    errors.push('Lot size must be positive');
  }

  if (config.maxSpreadMultiplier < 1) {
    errors.push('Max spread multiplier must be at least 1');
  }

  if (config.minSpread < 0) {
    errors.push('Min spread must be non-negative');
  }

  return errors;
}
