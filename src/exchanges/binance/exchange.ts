/**
 * Binance Exchange Implementation
 *
 * Implements IExchange interface for Binance API
 */
import { Spot, Side, Interval, OrderType } from '@binance/connector-typescript';
import {
  IExchange,
  OrderBook,
  OrderBookEntry,
  Balance,
  Position,
  Order,
  OrderRequest,
  Candle,
  ExchangeError,
} from '../interface.js';
import { BINANCE_CONFIG } from '../../config/index.js';

/**
 * Binance API response types
 */
interface BinanceOrderBookResponse {
  lastUpdateId: number;
  bids: string[][];
  asks: string[][];
}

interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceAccountInfo {
  balances: BinanceBalance[];
}

interface BinanceOrderResponse {
  orderId: number;
  clientOrderId: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  origQty: string;
  executedQty: string;
  price: string;
  avgPrice?: string;
  time: number;
  updateTime: number;
}

type BinanceKline = (string | number)[];

/**
 * Binance exchange implementation
 */
export class BinanceExchange implements IExchange {
  readonly name = 'Binance';
  private client: Spot;

  constructor() {
    this.client = new Spot(
      BINANCE_CONFIG.API_KEY,
      BINANCE_CONFIG.SECRET_KEY,
      {
        baseURL: BINANCE_CONFIG.BASE_URL,
        timeout: BINANCE_CONFIG.TIMEOUT,
      }
    );
  }

  // ==================== Market Data ====================

  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    try {
      const response = await this.client.orderBook(symbol.toUpperCase(), { limit }) as BinanceOrderBookResponse;

      return {
        symbol: symbol.toUpperCase(),
        timestamp: Date.now(),
        lastUpdateId: response.lastUpdateId,
        bids: response.bids.map((b: string[]): OrderBookEntry => ({
          price: parseFloat(b[0]),
          quantity: parseFloat(b[1]),
        })),
        asks: response.asks.map((a: string[]): OrderBookEntry => ({
          price: parseFloat(a[0]),
          quantity: parseFloat(a[1]),
        })),
      };
    } catch (error) {
      throw new ExchangeError(
        `Failed to get order book: ${error instanceof Error ? error.message : String(error)}`,
        'ORDER_BOOK_ERROR',
        this.name
      );
    }
  }

  async getMidPrice(symbol: string): Promise<number> {
    const orderBook = await this.getOrderBook(symbol, 5);
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      throw new ExchangeError('Empty order book', 'EMPTY_ORDER_BOOK', this.name);
    }
    return (orderBook.bids[0].price + orderBook.asks[0].price) / 2;
  }

  async getRecentTrades(symbol: string, limit: number = 100): Promise<Candle[]> {
    // Binance doesn't have a direct recent trades endpoint for candles,
    // so we use 1m klines as a proxy for recent trades
    return this.getKlines(symbol, '1m', limit);
  }

  async getKlines(
    symbol: string,
    interval: string = '1m',
    limit: number = 100
  ): Promise<Candle[]> {
    try {
      const klines = await this.client.klineCandlestickData(
        symbol.toUpperCase(),
        interval as unknown as Interval,
        { limit }
      ) as BinanceKline[];

      return klines.map((k: BinanceKline): Candle => ({
        timestamp: Number(k[0]),
        open: parseFloat(String(k[1])),
        high: parseFloat(String(k[2])),
        low: parseFloat(String(k[3])),
        close: parseFloat(String(k[4])),
        volume: parseFloat(String(k[5])),
      }));
    } catch (error) {
      throw new ExchangeError(
        `Failed to get klines: ${error instanceof Error ? error.message : String(error)}`,
        'KLINES_ERROR',
        this.name
      );
    }
  }

  // ==================== Account ====================

  async getBalance(asset: string): Promise<Balance> {
    try {
      const accountInfo = await this.client.accountInfo() as unknown as BinanceAccountInfo;
      const balance = accountInfo.balances.find(
        (b: BinanceBalance) => b.asset === asset.toUpperCase()
      );

      if (!balance) {
        throw new ExchangeError(`Balance not found for ${asset}`, 'BALANCE_NOT_FOUND', this.name);
      }

      const free = parseFloat(balance.free);
      const locked = parseFloat(balance.locked);

      return {
        asset: asset.toUpperCase(),
        free,
        locked,
        total: free + locked,
      };
    } catch (error) {
      if (error instanceof ExchangeError) throw error;
      throw new ExchangeError(
        `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`,
        'BALANCE_ERROR',
        this.name
      );
    }
  }

  async getAllBalances(): Promise<Balance[]> {
    try {
      const accountInfo = await this.client.accountInfo() as unknown as BinanceAccountInfo;

      return accountInfo.balances
        .filter((b: BinanceBalance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map((b: BinanceBalance): Balance => {
          const free = parseFloat(b.free);
          const locked = parseFloat(b.locked);
          return {
            asset: b.asset,
            free,
            locked,
            total: free + locked,
          };
        });
    } catch (error) {
      throw new ExchangeError(
        `Failed to get balances: ${error instanceof Error ? error.message : String(error)}`,
        'BALANCES_ERROR',
        this.name
      );
    }
  }

  async getPosition(symbol: string): Promise<Position | null> {
    // For spot markets, position is derived from balance
    // For futures, this would call the futures API
    try {
      const baseAsset = symbol.replace(/USDT|BUSD|USDC$/, '');
      const balance = await this.getBalance(baseAsset);

      if (balance.total === 0) {
        return null;
      }

      // Get current price for unrealized PnL calculation
      const midPrice = await this.getMidPrice(symbol);

      return {
        symbol: symbol.toUpperCase(),
        quantity: balance.total,
        entryPrice: midPrice, // Simplified - actual would use weighted avg
        unrealizedPnl: 0,     // Simplified calculation
        marginType: 'crossed',
      };
    } catch (error) {
      throw new ExchangeError(
        `Failed to get position: ${error instanceof Error ? error.message : String(error)}`,
        'POSITION_ERROR',
        this.name
      );
    }
  }

  async getAllPositions(): Promise<Position[]> {
    // Simplified implementation - would need to track which symbols to check
    return [];
  }

  // ==================== Orders ====================

  async placeOrder(order: OrderRequest): Promise<Order> {
    try {
      const params: Record<string, string | number | undefined> = {
        symbol: order.symbol.toUpperCase(),
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price,
        stopPrice: order.stopPrice,
        timeInForce: order.timeInForce,
        newClientOrderId: order.clientOrderId,
      };

      // Remove undefined values
      Object.keys(params).forEach(key => {
        if (params[key] === undefined) {
          delete params[key];
        }
      });

      const response = await this.client.newOrder(
        order.symbol.toUpperCase(),
        order.side as Side,
        order.type as unknown as OrderType,
        params
      ) as unknown as BinanceOrderResponse;

      return this.formatOrder(response);
    } catch (error) {
      throw new ExchangeError(
        `Failed to place order: ${error instanceof Error ? error.message : String(error)}`,
        'ORDER_ERROR',
        this.name
      );
    }
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    try {
      await this.client.cancelOrder(symbol.toUpperCase(), { orderId: parseInt(orderId, 10) });
    } catch (error) {
      throw new ExchangeError(
        `Failed to cancel order: ${error instanceof Error ? error.message : String(error)}`,
        'CANCEL_ERROR',
        this.name
      );
    }
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    try {
      await this.client.cancelAllOpenOrdersOnASymbol(symbol.toUpperCase());
    } catch (error) {
      throw new ExchangeError(
        `Failed to cancel all orders: ${error instanceof Error ? error.message : String(error)}`,
        'CANCEL_ALL_ERROR',
        this.name
      );
    }
  }

  async getOrder(symbol: string, orderId: string): Promise<Order | null> {
    try {
      const response = await this.client.getOrder(symbol.toUpperCase(), { orderId: parseInt(orderId, 10) }) as BinanceOrderResponse;
      return this.formatOrder(response);
    } catch (error) {
      if ((error as { code?: number }).code === -2013) {
        // Order does not exist
        return null;
      }
      throw new ExchangeError(
        `Failed to get order: ${error instanceof Error ? error.message : String(error)}`,
        'GET_ORDER_ERROR',
        this.name
      );
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const options: { symbol?: string } = {};
      if (symbol) {
        options.symbol = symbol.toUpperCase();
      }

      const response = await this.client.currentOpenOrders(options) as BinanceOrderResponse[];
      return response.map((o: BinanceOrderResponse) => this.formatOrder(o));
    } catch (error) {
      throw new ExchangeError(
        `Failed to get open orders: ${error instanceof Error ? error.message : String(error)}`,
        'OPEN_ORDERS_ERROR',
        this.name
      );
    }
  }

  // ==================== Private Methods ====================

  private formatOrder(response: BinanceOrderResponse): Order {
    return {
      orderId: response.orderId.toString(),
      clientOrderId: response.clientOrderId,
      symbol: response.symbol,
      side: response.side as 'BUY' | 'SELL',
      type: response.type as 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET',
      status: this.mapOrderStatus(response.status),
      quantity: parseFloat(response.origQty),
      executedQuantity: parseFloat(response.executedQty),
      price: parseFloat(response.price),
      avgPrice: response.avgPrice ? parseFloat(response.avgPrice) : undefined,
      createdAt: response.time,
      updatedAt: response.updateTime,
    };
  }

  private mapOrderStatus(status: string): Order['status'] {
    const statusMap: Record<string, Order['status']> = {
      'NEW': 'NEW',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
      'FILLED': 'FILLED',
      'CANCELED': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'EXPIRED': 'EXPIRED',
    };
    return statusMap[status] || 'NEW';
  }
}

/**
 * Create Binance exchange instance
 */
export function createBinanceExchange(): IExchange {
  return new BinanceExchange();
}

export default BinanceExchange;
