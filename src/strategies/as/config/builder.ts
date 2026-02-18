/**
 * Configuration builder and validator
 */
import { ASConfig } from './types.js';
import { AS_PRESETS, ASPreset } from './presets.js';

const DEFAULT_AS_CONFIG: Partial<ASConfig> = {
  gamma: 0.5,
  maxSpreadMultiplier: 3.0,
  minSpread: 0.01,
  targetInventory: 0,
  updateIntervalMs: 1000,
  volatilityWindow: 100,
  kappaWindow: 50,
  dryRun: true,
  stopLossThreshold: -1000,
};

export function createASConfig(config: Partial<ASConfig>): ASConfig {
  const symbol = config.symbol || 'BTCUSDT';
  const baseAsset = config.baseAsset || symbol.replace(/USDT|BUSD|USDC$/, '');
  const quoteAsset = config.quoteAsset || 'USDT';

  return {
    name: config.name || `AS-${symbol}`,
    symbol,
    baseAsset,
    quoteAsset,
    orderSize: config.orderSize || 0.001,
    maxPosition: config.maxPosition || 0.1,
    minPosition: config.minPosition || -0.1,
    tickSize: config.tickSize || 0.01,
    lotSize: config.lotSize || 0.0001,

    gamma: config.gamma ?? DEFAULT_AS_CONFIG.gamma!,
    maxSpreadMultiplier: config.maxSpreadMultiplier ?? DEFAULT_AS_CONFIG.maxSpreadMultiplier!,
    minSpread: config.minSpread ?? DEFAULT_AS_CONFIG.minSpread!,
    targetInventory: config.targetInventory ?? DEFAULT_AS_CONFIG.targetInventory!,
    updateIntervalMs: config.updateIntervalMs ?? DEFAULT_AS_CONFIG.updateIntervalMs!,
    volatilityWindow: config.volatilityWindow ?? DEFAULT_AS_CONFIG.volatilityWindow!,
    kappaWindow: config.kappaWindow ?? DEFAULT_AS_CONFIG.kappaWindow!,
    dryRun: config.dryRun ?? DEFAULT_AS_CONFIG.dryRun!,
    stopLossThreshold: config.stopLossThreshold ?? DEFAULT_AS_CONFIG.stopLossThreshold!,

    kappa: config.kappa,
    sigma: config.sigma,
  };
}

export function createASConfigFromPreset(
  preset: ASPreset,
  overrides: Partial<ASConfig> = {}
): ASConfig {
  const presetConfig = AS_PRESETS[preset];
  return createASConfig({
    ...presetConfig,
    ...overrides,
  });
}

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
