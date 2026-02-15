/**
 * Binance Service - Order Book API Wrapper
 *
 * Encapsulates Binance API calls for order book data retrieval
 */
import { Spot } from '@binance/connector-typescript';
import { BINANCE_CONFIG, TRADING_CONFIG } from '../config/index';
import { logger, type FormattedOrderBook } from '../utils/logger';

/**
 * Market type
 */
export type MarketType = 'SPOT' | 'FUTURES';

/**
 * Order book response from Binance API
 */
interface OrderBookResponse {
  lastUpdateId: number;
  bids: string[][];
  asks: string[][];
}

/**
 * Binance Service Class
 * Encapsulates Binance API calls for order book data retrieval
 */
export class BinanceService {
  private spotClient: Spot;
  private marketType: MarketType;

  /**
   * Create Binance service instance
   * @param marketType Market type: 'SPOT' or 'FUTURES'
   */
  constructor(marketType: MarketType = 'SPOT') {
    this.marketType = marketType;
    this.spotClient = new Spot(
      BINANCE_CONFIG.API_KEY,
      BINANCE_CONFIG.SECRET_KEY,
      {
        baseURL: BINANCE_CONFIG.BASE_URL,
        timeout: BINANCE_CONFIG.TIMEOUT,
      }
    );

    logger.info(`BinanceService initialized for ${marketType} market`);
  }

  /**
   * Get order book depth data
   * @param symbol Trading pair, e.g., 'BTCUSDT'
   * @param limit Depth limit: 5, 10, 20, 50, 100, 500, 1000, 5000
   * @returns Formatted order book data
   */
  async getOrderBook(
    symbol: string = TRADING_CONFIG.DEFAULT_SYMBOL,
    limit: number = TRADING_CONFIG.DEFAULT_DEPTH_LIMIT
  ): Promise<FormattedOrderBook> {
    try {
      // Normalize trading pair format
      const formattedSymbol = symbol.toUpperCase();

      logger.debug(`Fetching order book for ${formattedSymbol} with limit ${limit}`);

      // Call Binance API to get order book
      const response: OrderBookResponse = await this.spotClient.orderBook(
        formattedSymbol,
        { limit }
      );

      // Convert to internal format
      return this.formatOrderBook(response, formattedSymbol);
    } catch (error) {
      logger.error(`Failed to fetch order book for ${symbol}:`, error);
      throw new BinanceServiceError(
        `Failed to fetch order book: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Format order book data
   */
  private formatOrderBook(
    response: OrderBookResponse,
    symbol: string
  ): FormattedOrderBook {
    return {
      symbol,
      lastUpdateId: response.lastUpdateId,
      bids: response.bids.map((bid: string[]) => ({
        price: bid[0],
        quantity: bid[1],
      })),
      asks: response.asks.map((ask: string[]) => ({
        price: ask[0],
        quantity: ask[1],
      })),
    };
  }

  /**
   * Get real-time order book data stream
   * Poll for latest data
   * @param symbol Trading pair
   * @param limit Depth limit
   * @param intervalMs Polling interval (milliseconds)
   * @param callback Data callback function
   */
  async streamOrderBook(
    symbol: string = TRADING_CONFIG.DEFAULT_SYMBOL,
    limit: number = 20,
    intervalMs: number = 1000,
    callback: (orderBook: FormattedOrderBook) => void
  ): Promise<() => void> {
    let isRunning = true;

    const fetchLoop = async () => {
      while (isRunning) {
        try {
          const orderBook = await this.getOrderBook(symbol, limit);
          callback(orderBook);
        } catch (error) {
          logger.error('Error in order book stream:', error);
        }

        // Wait for next poll
        await sleep(intervalMs);
      }
    };

    // Start polling
    fetchLoop();

    // Return stop function
    return () => {
      isRunning = false;
    };
  }

  /**
   * Set market type
   */
  setMarketType(type: MarketType): void {
    this.marketType = type;
    logger.info(`Market type changed to: ${type}`);
  }

  /**
   * Get current market type
   */
  getMarketType(): MarketType {
    return this.marketType;
  }
}

/**
 * Binance service error class
 */
export class BinanceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinanceServiceError';
  }
}

/**
 * Sleep/delay function
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create Binance service instance
 */
export function createBinanceService(marketType?: MarketType): BinanceService {
  return new BinanceService(marketType);
}

export default BinanceService;
