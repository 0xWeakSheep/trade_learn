/**
 * Avellaneda-Stoikov Market Making Strategy
 *
 * @example
 * ```typescript
 * import { AvellanedaStoikovStrategy, createASConfig, AS_PRESETS } from './strategies/as/index.js';
 *
 * const strategy = new AvellanedaStoikovStrategy();
 * const config = createASConfig({
 *   symbol: 'BTCUSDT',
 *   ...AS_PRESETS.moderate,
 *   orderSize: 0.001,
 *   maxPosition: 0.01
 * });
 * ```
 */

// 策略主类
export { AvellanedaStoikovStrategy } from './engine/strategy.js';

// 配置相关
export { createASConfig, validateASConfig } from './config/builder.js';
export { AS_PRESETS } from './config/presets.js';
export type { ASPreset } from './config/presets.js';

// 类型定义
export type {
  ASConfig,
  ASParameters,
  ASQuote,
  ASState,
  ASCalculationResult,
} from './config/types.js';

// 核心公式
export {
  calculateReservationPrice,
  calculateHalfSpread,
  calculateBidAskPrices,
  calculateASQuote,
  calculateAS,
  roundToTickSize,
} from './core/formulas.js';

// 参数估计器
export {
  VolatilityCalculator,
  KappaCalculator,
  ParameterEstimator,
} from './core/estimators.js';

// 持仓管理
export { PositionManager } from './risk/position.js';
export type { PositionManagerConfig, Trade } from './risk/types.js';
