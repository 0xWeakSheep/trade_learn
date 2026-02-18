/**
 * Avellaneda-Stoikov Strategy Types
 */

export interface ASParameters {
  gamma: number;
  kappa: number;
  sigma: number;
  timeHorizon: number;
}

export interface ASConfig {
  name: string;
  symbol: string;
  quoteAsset: string;
  baseAsset: string;

  gamma: number;
  kappa?: number;
  sigma?: number;

  orderSize: number;
  maxSpreadMultiplier: number;
  minSpread: number;

  maxPosition: number;
  minPosition: number;
  targetInventory: number;

  tickSize: number;
  lotSize: number;

  updateIntervalMs: number;
  volatilityWindow: number;
  kappaWindow: number;

  dryRun: boolean;
  stopLossThreshold: number;
}

export interface ASQuote {
  midPrice: number;
  reservationPrice: number;
  halfSpread: number;
  bidPrice: number;
  askPrice: number;
  inventory: number;
  gamma: number;
  kappa: number;
  sigma: number;
  timestamp: number;
}

export interface ASState {
  inventory: number;
  midPrice: number;
  reservationPrice: number;
  halfSpread: number;
  bidPrice: number;
  askPrice: number;
  bidOrderId?: string;
  askOrderId?: string;
  parameters: ASParameters;
}

export interface ASCalculationResult {
  reservationPrice: number;
  halfSpread: number;
  bidPrice: number;
  askPrice: number;
  parameters: ASParameters;
}

export interface VolatilityConfig {
  window: number;
  useEwma: boolean;
  ewmaDecay: number;
}

export interface KappaConfig {
  window: number;
  spreadMultiplier: number;
}
