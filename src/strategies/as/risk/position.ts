/**
 * Position Manager for AS Strategy
 *
 * Tracks inventory, calculates PnL, and manages position limits
 */
import { IExchange, Position, Order } from '../../../exchanges/interface.js';
import { PositionManagerConfig, Trade } from './types.js';

export class PositionManager {
  private config: PositionManagerConfig;
  private exchange: IExchange;

  private _currentInventory: number = 0;
  private _averageEntryPrice: number = 0;
  private _unrealizedPnl: number = 0;
  private _realizedPnl: number = 0;
  private _totalBuyVolume: number = 0;
  private _totalSellVolume: number = 0;
  private trades: Trade[] = [];

  constructor(exchange: IExchange, config: PositionManagerConfig) {
    this.exchange = exchange;
    this.config = config;
  }

  get currentInventory(): number { return this._currentInventory; }
  get averageEntryPrice(): number { return this._averageEntryPrice; }
  get unrealizedPnl(): number { return this._unrealizedPnl; }
  get realizedPnl(): number { return this._realizedPnl; }
  get totalPnl(): number { return this._realizedPnl + this._unrealizedPnl; }
  get totalBuyVolume(): number { return this._totalBuyVolume; }
  get totalSellVolume(): number { return this._totalSellVolume; }

  get inventoryDeviation(): number {
    return Math.abs(this._currentInventory - this.config.targetInventory);
  }

  get inventoryRatio(): number {
    if (this._currentInventory >= 0) {
      return this._currentInventory / this.config.maxPosition;
    } else {
      return this._currentInventory / Math.abs(this.config.minPosition);
    }
  }

  get isMaxLong(): boolean { return this._currentInventory >= this.config.maxPosition; }
  get isMaxShort(): boolean { return this._currentInventory <= this.config.minPosition; }

  getTradeHistory(): Trade[] { return [...this.trades]; }

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
      this._realizedPnl = 0;
      this._unrealizedPnl = 0;
    } catch (error) {
      console.error('Failed to initialize position:', error);
      this._currentInventory = 0;
      this._averageEntryPrice = 0;
    }
  }

  updateFromOrder(order: Order): void {
    if (order.executedQuantity <= 0) return;

    const filledQty = order.executedQuantity;
    const filledPrice = order.avgPrice || order.price;

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

  private handleBuy(quantity: number, price: number): void {
    if (this._currentInventory >= 0) {
      const newInventory = this._currentInventory + quantity;
      this._averageEntryPrice =
        (this._currentInventory * this._averageEntryPrice + quantity * price) / newInventory;
      this._currentInventory = newInventory;
    } else {
      const shortReduction = Math.min(quantity, Math.abs(this._currentInventory));
      this._realizedPnl += shortReduction * (this._averageEntryPrice - price);
      this._currentInventory += quantity;

      if (this._currentInventory > 0) {
        this._averageEntryPrice = price;
      } else if (this._currentInventory === 0) {
        this._averageEntryPrice = 0;
      }
    }
  }

  private handleSell(quantity: number, price: number): void {
    if (this._currentInventory <= 0) {
      const newInventory = this._currentInventory - quantity;
      const currentNotional = Math.abs(this._currentInventory) * this._averageEntryPrice;
      const newNotional = quantity * price;
      this._averageEntryPrice = (currentNotional + newNotional) / Math.abs(newInventory);
      this._currentInventory = newInventory;
    } else {
      const longReduction = Math.min(quantity, this._currentInventory);
      this._realizedPnl += longReduction * (price - this._averageEntryPrice);
      this._currentInventory -= quantity;

      if (this._currentInventory < 0) {
        this._averageEntryPrice = price;
      } else if (this._currentInventory === 0) {
        this._averageEntryPrice = 0;
      }
    }
  }

  updateUnrealizedPnl(midPrice: number): void {
    if (this._currentInventory === 0) {
      this._unrealizedPnl = 0;
      return;
    }
    this._unrealizedPnl = this._currentInventory * (midPrice - this._averageEntryPrice);
  }

  canBuy(quantity: number): boolean {
    return this._currentInventory + quantity <= this.config.maxPosition;
  }

  canSell(quantity: number): boolean {
    return this._currentInventory - quantity >= this.config.minPosition;
  }

  getMaxBuyQuantity(): number {
    if (this._currentInventory >= this.config.maxPosition) return 0;
    return this.config.maxPosition - this._currentInventory;
  }

  getMaxSellQuantity(): number {
    if (this._currentInventory <= this.config.minPosition) return 0;
    return this._currentInventory - this.config.minPosition;
  }

  getStatus() {
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
