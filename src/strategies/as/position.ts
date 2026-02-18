/**
 * Position Manager for AS Strategy
 *
 * Tracks inventory, calculates PnL, and manages position limits
 */
import { IExchange, Position, Order } from '../../exchanges/interface.js';

/**
 * Trade record
 */
interface Trade {
  timestamp: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  symbol: string;
}

/**
 * Position manager configuration
 */
export interface PositionManagerConfig {
  /** Trading symbol */
  symbol: string;
  /** Maximum long position */
  maxPosition: number;
  /** Maximum short position (negative) */
  minPosition: number;
  /** Target inventory level */
  targetInventory: number;
}

/**
 * Position manager
 */
export class PositionManager {
  private config: PositionManagerConfig;
  private exchange: IExchange;

  // State
  private _currentInventory: number = 0;
  private _averageEntryPrice: number = 0;
  private _unrealizedPnl: number = 0;
  private _realizedPnl: number = 0;
  private _totalBuyVolume: number = 0;
  private _totalSellVolume: number = 0;
  private trades: Trade[] = [];

  /**
   * Create position manager
   */
  constructor(exchange: IExchange, config: PositionManagerConfig) {
    this.exchange = exchange;
    this.config = config;
  }

  // ==================== Getters ====================

  /**
   * Get current inventory (positive = long, negative = short)
   */
  get currentInventory(): number {
    return this._currentInventory;
  }

  /**
   * Get average entry price
   */
  get averageEntryPrice(): number {
    return this._averageEntryPrice;
  }

  /**
   * Get unrealized PnL
   */
  get unrealizedPnl(): number {
    return this._unrealizedPnl;
  }

  /**
   * Get realized PnL
   */
  get realizedPnl(): number {
    return this._realizedPnl;
  }

  /**
   * Get total PnL
   */
  get totalPnl(): number {
    return this._realizedPnl + this._unrealizedPnl;
  }

  /**
   * Get total buy volume
   */
  get totalBuyVolume(): number {
    return this._totalBuyVolume;
  }

  /**
   * Get total sell volume
   */
  get totalSellVolume(): number {
    return this._totalSellVolume;
  }

  /**
   * Get absolute inventory deviation from target
   */
  get inventoryDeviation(): number {
    return Math.abs(this._currentInventory - this.config.targetInventory);
  }

  /**
   * Get inventory as fraction of max position (0 to 1)
   */
  get inventoryRatio(): number {
    if (this._currentInventory >= 0) {
      return this._currentInventory / this.config.maxPosition;
    } else {
      return this._currentInventory / Math.abs(this.config.minPosition);
    }
  }

  /**
   * Check if position is at maximum long
   */
  get isMaxLong(): boolean {
    return this._currentInventory >= this.config.maxPosition;
  }

  /**
   * Check if position is at maximum short
   */
  get isMaxShort(): boolean {
    return this._currentInventory <= this.config.minPosition;
  }

  /**
   * Get all trades
   */
  getTradeHistory(): Trade[] {
    return [...this.trades];
  }

  // ==================== Methods ====================

  /**
   * Initialize position from exchange
   */
  async initialize(): Promise<void> {
    try {
      const position = await this.exchange.getPosition(this.config.symbol);

      if (position) {
        this._currentInventory = position.quantity;
        this._averageEntryPrice = position.entryPrice;
      } else {
        this._currentInventory = 0;
        this._averageEntryPrice = 0;
      }

      // Reset PnL tracking
      this._realizedPnl = 0;
      this._unrealizedPnl = 0;
    } catch (error) {
      console.error('Failed to initialize position:', error);
      // Start with zero position as fallback
      this._currentInventory = 0;
      this._averageEntryPrice = 0;
    }
  }

  /**
   * Update inventory from a filled order
   */
  updateFromOrder(order: Order): void {
    if (order.executedQuantity <= 0) {
      return;
    }

    const filledQty = order.executedQuantity;
    const filledPrice = order.avgPrice || order.price;

    // Record trade
    this.trades.push({
      timestamp: Date.now(),
      side: order.side,
      quantity: filledQty,
      price: filledPrice,
      symbol: order.symbol,
    });

    if (order.side === 'BUY') {
      this._totalBuyVolume += filledQty;
      this.handleBuy(filledQty, filledPrice);
    } else {
      this._totalSellVolume += filledQty;
      this.handleSell(filledQty, filledPrice);
    }
  }

  /**
   * Handle buy execution
   */
  private handleBuy(quantity: number, price: number): void {
    if (this._currentInventory >= 0) {
      // Adding to long position
      const newInventory = this._currentInventory + quantity;
      this._averageEntryPrice =
        (this._currentInventory * this._averageEntryPrice + quantity * price) /
        newInventory;
      this._currentInventory = newInventory;
    } else {
      // Reducing short position
      const shortReduction = Math.min(quantity, Math.abs(this._currentInventory));
      const pnl = shortReduction * (this._averageEntryPrice - price);
      this._realizedPnl += pnl;

      this._currentInventory += quantity;

      if (this._currentInventory > 0) {
        // Flipped to long
        this._averageEntryPrice = price;
      } else if (this._currentInventory === 0) {
        this._averageEntryPrice = 0;
      }
    }
  }

  /**
   * Handle sell execution
   */
  private handleSell(quantity: number, price: number): void {
    if (this._currentInventory <= 0) {
      // Adding to short position
      const newInventory = this._currentInventory - quantity;
      const currentNotional = Math.abs(this._currentInventory) * this._averageEntryPrice;
      const newNotional = quantity * price;
      this._averageEntryPrice =
        (currentNotional + newNotional) / Math.abs(newInventory);
      this._currentInventory = newInventory;
    } else {
      // Reducing long position
      const longReduction = Math.min(quantity, this._currentInventory);
      const pnl = longReduction * (price - this._averageEntryPrice);
      this._realizedPnl += pnl;

      this._currentInventory -= quantity;

      if (this._currentInventory < 0) {
        // Flipped to short
        this._averageEntryPrice = price;
      } else if (this._currentInventory === 0) {
        this._averageEntryPrice = 0;
      }
    }
  }

  /**
   * Update unrealized PnL with current mid price
   */
  updateUnrealizedPnl(midPrice: number): void {
    if (this._currentInventory === 0) {
      this._unrealizedPnl = 0;
      return;
    }

    this._unrealizedPnl = this._currentInventory * (midPrice - this._averageEntryPrice);
  }

  /**
   * Check if can place buy order (inventory limit)
   */
  canBuy(quantity: number): boolean {
    const newInventory = this._currentInventory + quantity;
    return newInventory <= this.config.maxPosition;
  }

  /**
   * Check if can place sell order (inventory limit)
   */
  canSell(quantity: number): boolean {
    const newInventory = this._currentInventory - quantity;
    return newInventory >= this.config.minPosition;
  }

  /**
   * Get max buy quantity within position limits
   */
  getMaxBuyQuantity(): number {
    if (this._currentInventory >= this.config.maxPosition) {
      return 0;
    }
    return this.config.maxPosition - this._currentInventory;
  }

  /**
   * Get max sell quantity within position limits
   */
  getMaxSellQuantity(): number {
    if (this._currentInventory <= this.config.minPosition) {
      return 0;
    }
    return this._currentInventory - this.config.minPosition;
  }

  /**
   * Get position status summary
   */
  getStatus(): {
    inventory: number;
    avgEntryPrice: number;
    unrealizedPnl: number;
    realizedPnl: number;
    totalPnl: number;
    inventoryRatio: number;
    isMaxLong: boolean;
    isMaxShort: boolean;
  } {
    return {
      inventory: this._currentInventory,
      avgEntryPrice: this._averageEntryPrice,
      unrealizedPnl: this._unrealizedPnl,
      realizedPnl: this._realizedPnl,
      totalPnl: this.totalPnl,
      inventoryRatio: this.inventoryRatio,
      isMaxLong: this.isMaxLong,
      isMaxShort: this.isMaxShort,
    };
  }

  /**
   * Reset position tracking
   */
  reset(): void {
    this._currentInventory = 0;
    this._averageEntryPrice = 0;
    this._unrealizedPnl = 0;
    this._realizedPnl = 0;
    this._totalBuyVolume = 0;
    this._totalSellVolume = 0;
    this.trades = [];
  }
}
