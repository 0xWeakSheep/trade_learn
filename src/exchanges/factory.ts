/**
 * Exchange Factory
 *
 * Creates exchange instances based on type
 * Supports duck typing - any exchange implementing IExchange can be registered
 */
import { IExchange, ExchangeError } from './interface.js';
import { BinanceExchange } from './binance/exchange.js';

/**
 * Exchange type enum
 */
export enum ExchangeType {
  BINANCE = 'binance',
  // Add more exchanges here
  // COINBASE = 'coinbase',
  // BYBIT = 'bybit',
  // OKX = 'okx',
}

/**
 * Exchange factory class
 */
export class ExchangeFactory {
  private static instances = new Map<string, IExchange>();

  /**
   * Create or get an exchange instance
   * @param type Exchange type
   * @returns Exchange instance implementing IExchange
   */
  static create(type: ExchangeType | string): IExchange {
    // Return existing instance if available
    if (this.instances.has(type)) {
      return this.instances.get(type)!;
    }

    // Create new instance based on type
    let exchange: IExchange;

    switch (type.toLowerCase()) {
      case ExchangeType.BINANCE:
      case 'binance':
        exchange = new BinanceExchange();
        break;

      // Add more exchanges here:
      // case ExchangeType.COINBASE:
      //   exchange = new CoinbaseExchange();
      //   break;

      default:
        throw new ExchangeError(
          `Unknown exchange type: ${type}. Supported types: ${Object.values(ExchangeType).join(', ')}`,
          'UNKNOWN_EXCHANGE',
          'Factory'
        );
    }

    // Store instance
    this.instances.set(type, exchange);
    return exchange;
  }

  /**
   * Register a custom exchange
   * @param type Exchange type name
   * @param exchange Exchange instance
   */
  static register(type: string, exchange: IExchange): void {
    this.instances.set(type, exchange);
  }

  /**
   * Get an existing exchange instance
   * @param type Exchange type
   */
  static get(type: ExchangeType | string): IExchange | undefined {
    return this.instances.get(type);
  }

  /**
   * Clear all cached instances
   */
  static clear(): void {
    this.instances.clear();
  }

  /**
   * List all registered exchanges
   */
  static list(): string[] {
    return Array.from(this.instances.keys());
  }
}

/**
 * Convenience function to create exchange
 */
export function createExchange(type: ExchangeType | string): IExchange {
  return ExchangeFactory.create(type);
}

export default ExchangeFactory;
