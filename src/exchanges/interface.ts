/**
 * Exchange API Abstract Interface (Duck Model)
 *
 * All exchanges must implement this interface to be used by strategies.
 * Strategies depend only on this interface, not on specific exchange implementations.
 */

/**
 * Order book entry
 */
export interface OrderBookEntry {
  price: number;
  quantity: number;
}

/**
 * Order book data
 */
export interface OrderBook {
  symbol: string;
  timestamp: number;
  lastUpdateId: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

/**
 * Balance information
 */
export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

/**
 * Position information
 */
export interface Position {
  symbol: string;
  quantity: number;      // positive for long, negative for short
  entryPrice: number;
  unrealizedPnl: number;
  marginType: 'isolated' | 'crossed';
}

/**
 * Order side
 */
export type OrderSide = 'BUY' | 'SELL';

/**
 * Order type
 */
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'STOP_MARKET';

/**
 * Order status
 */
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';

/**
 * Order request
 */
export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  clientOrderId?: string;
}

/**
 * Order response
 */
export interface Order {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  executedQuantity: number;
  price: number;
  avgPrice?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Trade/Candle data for calculations
 */
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Exchange interface - Duck Model
 * All exchanges must implement this interface
 */
export interface IExchange {
  /** Exchange name */
  readonly name: string;

  // ==================== Market Data ====================

  /**
   * Get order book for a symbol
   * @param symbol Trading pair (e.g., 'BTCUSDT')
   * @param limit Depth limit (default: 20)
   */
  getOrderBook(symbol: string, limit?: number): Promise<OrderBook>;

  /**
   * Get mid price for a symbol
   * @param symbol Trading pair
   */
  getMidPrice(symbol: string): Promise<number>;

  /**
   * Get recent trades
   * @param symbol Trading pair
   * @param limit Number of trades (default: 100)
   */
  getRecentTrades(symbol: string, limit?: number): Promise<Candle[]>;

  /**
   * Get klines/candlestick data
   * @param symbol Trading pair
   * @param interval Candle interval (e.g., '1m', '5m', '1h')
   * @param limit Number of candles (default: 100)
   */
  getKlines(symbol: string, interval: string, limit?: number): Promise<Candle[]>;

  // ==================== Account ====================

  /**
   * Get balance for a specific asset
   * @param asset Asset symbol (e.g., 'BTC', 'USDT')
   */
  getBalance(asset: string): Promise<Balance>;

  /**
   * Get all balances
   */
  getAllBalances(): Promise<Balance[]>;

  /**
   * Get position for a symbol
   * @param symbol Trading pair
   */
  getPosition(symbol: string): Promise<Position | null>;

  /**
   * Get all positions
   */
  getAllPositions(): Promise<Position[]>;

  // ==================== Orders ====================

  /**
   * Place a new order
   * @param order Order request
   */
  placeOrder(order: OrderRequest): Promise<Order>;

  /**
   * Cancel an order
   * @param symbol Trading pair
   * @param orderId Order ID
   */
  cancelOrder(symbol: string, orderId: string): Promise<void>;

  /**
   * Cancel all orders for a symbol
   * @param symbol Trading pair
   */
  cancelAllOrders(symbol: string): Promise<void>;

  /**
   * Get order details
   * @param symbol Trading pair
   * @param orderId Order ID
   */
  getOrder(symbol: string, orderId: string): Promise<Order | null>;

  /**
   * Get all open orders for a symbol
   * @param symbol Trading pair (optional, if not provided returns all open orders)
   */
  getOpenOrders(symbol?: string): Promise<Order[]>;
}

/**
 * Exchange factory type
 */
export type ExchangeFactory = (type: string, config?: unknown) => IExchange;

/**
 * Exchange error class
 */
export class ExchangeError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly exchange?: string
  ) {
    super(message);
    this.name = 'ExchangeError';
  }
}
