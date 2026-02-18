/**
 * Strategy Interface
 *
 * All trading strategies must implement this interface
 */
import { IExchange, Order } from '../exchanges/interface.js';

/**
 * Strategy configuration base interface
 */
export interface StrategyConfig {
  /** Strategy name */
  name: string;
  /** Trading symbol */
  symbol: string;
  /** Quote asset (e.g., USDT) */
  quoteAsset: string;
  /** Base asset (e.g., BTC) */
  baseAsset: string;
  /** Order size */
  orderSize: number;
  /** Price tick size */
  tickSize: number;
  /** Lot size */
  lotSize: number;
  /** Max position limit (positive number) */
  maxPosition: number;
  /** Min position limit (negative number) */
  minPosition: number;
  /** Update interval in milliseconds */
  updateIntervalMs: number;
  /** Enable dry run mode (no real orders) */
  dryRun: boolean;
}

/**
 * Strategy state
 */
export type StrategyState = 'INITIALIZING' | 'RUNNING' | 'PAUSED' | 'STOPPING' | 'STOPPED' | 'ERROR';

/**
 * Strategy statistics
 */
export interface StrategyStats {
  /** Total orders placed */
  totalOrdersPlaced: number;
  /** Total orders filled */
  totalOrdersFilled: number;
  /** Total buy volume */
  totalBuyVolume: number;
  /** Total sell volume */
  totalSellVolume: number;
  /** Realized PnL */
  realizedPnl: number;
  /** Number of updates processed */
  updateCount: number;
  /** Strategy start time */
  startTime: number;
  /** Last update time */
  lastUpdateTime: number;
}

/**
 * Strategy interface
 * All strategies must implement this
 */
export interface IStrategy {
  /** Strategy name */
  readonly name: string;
  /** Current state */
  readonly state: StrategyState;
  /** Strategy statistics */
  readonly stats: StrategyStats;

  /**
   * Initialize the strategy
   * @param exchange Exchange instance
   * @param config Strategy configuration
   */
  initialize(exchange: IExchange, config: StrategyConfig): Promise<void>;

  /**
   * Start the strategy
   */
  start(): Promise<void>;

  /**
   * Pause the strategy (keeps positions)
   */
  pause(): Promise<void>;

  /**
   * Resume the strategy
   */
  resume(): Promise<void>;

  /**
   * Stop the strategy (cancels all orders)
   */
  stop(): Promise<void>;

  /**
   * Get current strategy status
   */
  getStatus(): {
    state: StrategyState;
    stats: StrategyStats;
    currentPosition: number;
    midPrice: number;
  };
}

/**
 * Strategy event types
 */
export type StrategyEventType =
  | 'STATE_CHANGE'
  | 'ORDER_PLACED'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELLED'
  | 'POSITION_CHANGE'
  | 'ERROR'
  | 'UPDATE';

/**
 * Strategy event
 */
export interface StrategyEvent {
  type: StrategyEventType;
  timestamp: number;
  data: unknown;
}

/**
 * Strategy event handler
 */
export type StrategyEventHandler = (event: StrategyEvent) => void;

/**
 * Base strategy abstract class
 * Provides common functionality for all strategies
 */
export abstract class BaseStrategy implements IStrategy {
  abstract readonly name: string;

  protected _state: StrategyState = 'INITIALIZING';
  protected _exchange!: IExchange;
  protected _config!: StrategyConfig;
  protected _stats: StrategyStats = {
    totalOrdersPlaced: 0,
    totalOrdersFilled: 0,
    totalBuyVolume: 0,
    totalSellVolume: 0,
    realizedPnl: 0,
    updateCount: 0,
    startTime: 0,
    lastUpdateTime: 0,
  };

  protected _eventHandlers: Map<StrategyEventType, StrategyEventHandler[]> = new Map();
  protected _currentPosition: number = 0;
  protected _midPrice: number = 0;

  get state(): StrategyState {
    return this._state;
  }

  get stats(): StrategyStats {
    return { ...this._stats };
  }

  async initialize(exchange: IExchange, config: StrategyConfig): Promise<void> {
    this._exchange = exchange;
    this._config = config;
    this._state = 'INITIALIZING';
    this.emitEvent('STATE_CHANGE', { state: this._state });

    // Initialize stats
    this._stats.startTime = Date.now();
    this._stats.lastUpdateTime = Date.now();

    // Subclasses should override to perform additional initialization
    await this.onInitialize();

    this._state = 'STOPPED';
    this.emitEvent('STATE_CHANGE', { state: this._state });
  }

  async start(): Promise<void> {
    if (this._state === 'RUNNING') {
      throw new Error('Strategy is already running');
    }

    this._state = 'RUNNING';
    this.emitEvent('STATE_CHANGE', { state: this._state });

    await this.onStart();
  }

  async pause(): Promise<void> {
    if (this._state !== 'RUNNING') {
      throw new Error('Strategy is not running');
    }

    this._state = 'PAUSED';
    this.emitEvent('STATE_CHANGE', { state: this._state });

    await this.onPause();
  }

  async resume(): Promise<void> {
    if (this._state !== 'PAUSED') {
      throw new Error('Strategy is not paused');
    }

    this._state = 'RUNNING';
    this.emitEvent('STATE_CHANGE', { state: this._state });

    await this.onResume();
  }

  async stop(): Promise<void> {
    if (this._state === 'STOPPED' || this._state === 'STOPPING') {
      return;
    }

    this._state = 'STOPPING';
    this.emitEvent('STATE_CHANGE', { state: this._state });

    await this.onStop();

    this._state = 'STOPPED';
    this.emitEvent('STATE_CHANGE', { state: this._state });
  }

  getStatus() {
    return {
      state: this._state,
      stats: this.stats,
      currentPosition: this._currentPosition,
      midPrice: this._midPrice,
    };
  }

  /**
   * Register event handler
   */
  on(event: StrategyEventType, handler: StrategyEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, []);
    }
    this._eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event handler
   */
  off(event: StrategyEventType, handler: StrategyEventHandler): void {
    const handlers = this._eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to all registered handlers
   */
  protected emitEvent(type: StrategyEventType, data: unknown): void {
    const event: StrategyEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    const handlers = this._eventHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  // ==================== Abstract Methods ====================

  /**
   * Called during initialization
   * Override in subclass for custom initialization
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Called when strategy starts
   * Override in subclass to begin strategy execution
   */
  protected abstract onStart(): Promise<void>;

  /**
   * Called when strategy is paused
   * Override in subclass to handle pause
   */
  protected abstract onPause(): Promise<void>;

  /**
   * Called when strategy resumes
   * Override in subclass to handle resume
   */
  protected abstract onResume(): Promise<void>;

  /**
   * Called when strategy stops
   * Override in subclass for cleanup
   */
  protected abstract onStop(): Promise<void>;
}

/**
 * Strategy error class
 */
export class StrategyError extends Error {
  constructor(
    message: string,
    public readonly strategyName?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'StrategyError';
  }
}
