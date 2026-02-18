/**
 * Exchanges Module
 *
 * Provides unified access to different exchange implementations
 * using the duck typing pattern.
 */

// Export interface definitions (types only, not factory function)
export type * from './interface.js';
export { IExchange, OrderBook, OrderBookEntry, Balance, Position, Order, OrderRequest, Candle, ExchangeError } from './interface.js';

// Export factory
export { ExchangeFactory, ExchangeType, createExchange } from './factory.js';

// Export Binance implementation
export { BinanceExchange, createBinanceExchange } from './binance/exchange.js';
