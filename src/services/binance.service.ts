/**
 * 运行命令:
 * pnpm ts-node --esm src/services/binance.service.ts
 */
import {
  Spot,
  type OrderBookResponse,
} from '@binance/connector-typescript';
import { BINANCE_CONFIG, TRADING_CONFIG } from '../config/index.js';
import { logger, type FormattedOrderBook } from '../utils/logger.js';

/**
 * 市场类型
 */
export type MarketType = 'SPOT' | 'FUTURES';

/**
 * 币安服务类
 * 封装币安API调用，提供订单簿数据获取功能
 */
export class BinanceService {
  private spotClient: Spot;
  private marketType: MarketType;

  /**
   * 创建币安服务实例
   * @param marketType 市场类型: 'SPOT' 或 'FUTURES'
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
   * 获取订单簿深度数据
   * @param symbol 交易对，如 'BTCUSDT'
   * @param limit 深度限制: 5, 10, 20, 50, 100, 500, 1000, 5000
   * @returns 格式化的订单簿数据
   */
  async getOrderBook(
    symbol: string = TRADING_CONFIG.DEFAULT_SYMBOL,
    limit: number = TRADING_CONFIG.DEFAULT_DEPTH_LIMIT
  ): Promise<FormattedOrderBook> {
    try {
      // 标准化交易对格式
      const formattedSymbol = symbol.toUpperCase();

      logger.debug(`Fetching order book for ${formattedSymbol} with limit ${limit}`);

      // 调用币安API获取订单簿
      const response: OrderBookResponse = await this.spotClient.orderBook(
        formattedSymbol,
        limit
      );

      // 转换为内部格式
      return this.formatOrderBook(response, formattedSymbol);
    } catch (error) {
      logger.error(`Failed to fetch order book for ${symbol}:`, error);
      throw new BinanceServiceError(
        `Failed to fetch order book: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 格式化订单簿数据
   */
  private formatOrderBook(
    response: OrderBookResponse,
    symbol: string
  ): FormattedOrderBook {
    return {
      symbol,
      lastUpdateId: response.lastUpdateId,
      bids: response.bids.map(([price, quantity]) => ({
        price,
        quantity,
      })),
      asks: response.asks.map(([price, quantity]) => ({
        price,
        quantity,
      })),
    };
  }

  /**
   * 获取实时订单簿数据流
   * 轮询方式获取最新数据
   * @param symbol 交易对
   * @param limit 深度限制
   * @param intervalMs 轮询间隔(毫秒)
   * @param callback 数据回调函数
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

        // 等待下一次轮询
        await sleep(intervalMs);
      }
    };

    // 启动轮询
    fetchLoop();

    // 返回停止函数
    return () => {
      isRunning = false;
    };
  }

  /**
   * 设置市场类型
   */
  setMarketType(type: MarketType): void {
    this.marketType = type;
    logger.info(`Market type changed to: ${type}`);
  }

  /**
   * 获取当前市场类型
   */
  getMarketType(): MarketType {
    return this.marketType;
  }
}

/**
 * 币安服务错误类
 */
export class BinanceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinanceServiceError';
  }
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建币安服务实例
 */
export function createBinanceService(marketType?: MarketType): BinanceService {
  return new BinanceService(marketType);
}

export default BinanceService;
