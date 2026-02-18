/**
 * Avellaneda-Stoikov Market Making Strategy
 *
 * Main strategy implementation
 */
import { IExchange, Order, OrderSide } from '../../exchanges/interface.js';
import { BaseStrategy, StrategyConfig } from '../interface.js';
import {
  ASConfig,
  ASQuote,
  ASParameters,
} from './types.js';
import { createASConfig, validateASConfig } from './config.js';
import { calculateAS, roundToTickSize } from './core.js';
import { ParameterEstimator } from './calculator.js';
import { PositionManager, PositionManagerConfig } from './position.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger({ prefix: '[AS-Strategy]' });

/**
 * AS Strategy implementation
 */
export class AvellanedaStoikovStrategy extends BaseStrategy {
  readonly name = 'AvellanedaStoikov';

  private asConfig!: ASConfig;
  private estimator!: ParameterEstimator;
  private positionManager!: PositionManager;

  // Runtime state
  private updateTimer: NodeJS.Timeout | null = null;
  private bidOrderId: string | null = null;
  private askOrderId: string | null = null;
  private lastQuote: ASQuote | null = null;

  // Parameters
  private currentGamma: number = 0.5;
  private currentKappa: number = 0.01;
  private currentSigma: number = 0.001;

  /**
   * Initialize the strategy
   */
  protected async onInitialize(): Promise<void> {
    // Create AS config from base config
    this.asConfig = createASConfig({
      name: this._config.name,
      symbol: this._config.symbol,
      baseAsset: this._config.baseAsset,
      quoteAsset: this._config.quoteAsset,
      orderSize: this._config.orderSize,
      maxPosition: this._config.maxPosition,
      minPosition: this._config.minPosition,
      tickSize: this._config.tickSize,
      lotSize: this._config.lotSize,
      updateIntervalMs: this._config.updateIntervalMs,
      dryRun: this._config.dryRun,
    });

    // Validate configuration
    const errors = validateASConfig(this.asConfig);
    if (errors.length > 0) {
      throw new Error(`Invalid AS configuration: ${errors.join(', ')}`);
    }

    // Initialize parameter estimator
    this.estimator = new ParameterEstimator(
      this.asConfig.volatilityWindow,
      this.asConfig.kappaWindow,
      false
    );

    // Initialize position manager
    const positionConfig: PositionManagerConfig = {
      symbol: this.asConfig.symbol,
      maxPosition: this.asConfig.maxPosition,
      minPosition: this.asConfig.minPosition,
      targetInventory: this.asConfig.targetInventory,
    };
    this.positionManager = new PositionManager(this._exchange, positionConfig);
    await this.positionManager.initialize();

    // Set initial parameters
    this.currentGamma = this.asConfig.gamma;
    this.currentKappa = this.asConfig.kappa || 0.01;
    this.currentSigma = this.asConfig.sigma || 0.001;

    logger.info('AS Strategy initialized');
    logger.info(`Symbol: ${this.asConfig.symbol}`);
    logger.info(`Gamma: ${this.currentGamma}`);
    logger.info(`Dry run mode: ${this.asConfig.dryRun}`);
  }

  /**
   * Start the strategy
   */
  protected async onStart(): Promise<void> {
    logger.info('Starting AS strategy...');

    // Initial data collection
    await this.collectInitialData();

    // Start update loop
    this.scheduleUpdate();

    logger.info('AS strategy started successfully');
  }

  /**
   * Pause the strategy
   */
  protected async onPause(): Promise<void> {
    logger.info('Pausing AS strategy...');

    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    // Cancel existing orders
    await this.cancelAllOrders();

    logger.info('AS strategy paused');
  }

  /**
   * Resume the strategy
   */
  protected async onResume(): Promise<void> {
    logger.info('Resuming AS strategy...');

    // Reinitialize position
    await this.positionManager.initialize();

    // Restart update loop
    this.scheduleUpdate();

    logger.info('AS strategy resumed');
  }

  /**
   * Stop the strategy
   */
  protected async onStop(): Promise<void> {
    logger.info('Stopping AS strategy...');

    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    // Cancel all orders
    await this.cancelAllOrders();

    // Log final stats
    const status = this.positionManager.getStatus();
    logger.info('Final position status:', status);

    logger.info('AS strategy stopped');
  }

  /**
   * Collect initial market data for parameter estimation
   */
  private async collectInitialData(): Promise<void> {
    logger.info('Collecting initial market data...');

    // Get historical candles for volatility
    try {
      const candles = await this._exchange.getKlines(
        this.asConfig.symbol,
        '1m',
        this.asConfig.volatilityWindow
      );
      this.estimator.processCandles(candles);
      logger.info(`Loaded ${candles.length} candles for volatility estimation`);
    } catch (error) {
      logger.warn('Failed to load historical candles:', error);
    }

    // Get current order book for kappa
    try {
      const orderBook = await this._exchange.getOrderBook(this.asConfig.symbol, 5);
      this.estimator.processOrderBook(orderBook);
      logger.info('Loaded initial order book for kappa estimation');
    } catch (error) {
      logger.warn('Failed to load order book:', error);
    }

    // Update parameters if available
    this.updateParameters();

    logger.info('Initial data collection complete');
    logger.info(`Sigma: ${this.currentSigma.toFixed(6)}`);
    logger.info(`Kappa: ${this.currentKappa.toFixed(6)}`);
  }

  /**
   * Schedule next update
   */
  private scheduleUpdate(): void {
    this.updateTimer = setTimeout(
      () => this.runUpdate(),
      this.asConfig.updateIntervalMs
    );
  }

  /**
   * Main update loop
   */
  private async runUpdate(): Promise<void> {
    if (this._state !== 'RUNNING') {
      return;
    }

    try {
      await this.update();
    } catch (error) {
      logger.error('Error in update loop:', error);
      this.emitEvent('ERROR', { error });
    }

    // Schedule next update
    if (this._state === 'RUNNING') {
      this.scheduleUpdate();
    }
  }

  /**
   * Single update iteration
   */
  private async update(): Promise<void> {
    // Get market data
    const orderBook = await this._exchange.getOrderBook(this.asConfig.symbol, 5);
    const midPrice = (orderBook.bids[0].price + orderBook.asks[0].price) / 2;

    // Update estimator
    this.estimator.processOrderBook(orderBook);
    this.updateParameters();

    // Update position PnL
    this.positionManager.updateUnrealizedPnl(midPrice);

    // Check stop loss
    if (this.positionManager.totalPnl < this.asConfig.stopLossThreshold) {
      logger.error(`Stop loss triggered! PnL: ${this.positionManager.totalPnl}`);
      await this.stop();
      return;
    }

    // Calculate AS quote
    const params: ASParameters = {
      gamma: this.currentGamma,
      kappa: this.currentKappa,
      sigma: this.currentSigma,
      timeHorizon: 1.0,
    };

    const result = calculateAS(
      midPrice,
      this.positionManager.currentInventory,
      params,
      this.asConfig.tickSize,
      this.asConfig.minSpread,
      this.asConfig.maxSpreadMultiplier
    );

    this.lastQuote = {
      midPrice,
      reservationPrice: result.reservationPrice,
      halfSpread: result.halfSpread,
      bidPrice: result.bidPrice,
      askPrice: result.askPrice,
      inventory: this.positionManager.currentInventory,
      gamma: this.currentGamma,
      kappa: this.currentKappa,
      sigma: this.currentSigma,
      timestamp: Date.now(),
    };

    // Update stats
    this._midPrice = midPrice;
    this._currentPosition = this.positionManager.currentInventory;
    this._stats.lastUpdateTime = Date.now();
    this._stats.updateCount++;

    // Log quote
    this.logQuote();

    // Manage orders
    await this.manageOrders(result.bidPrice, result.askPrice);

    // Emit update event
    this.emitEvent('UPDATE', {
      quote: this.lastQuote,
      position: this.positionManager.getStatus(),
    });
  }

  /**
   * Update sigma and kappa from estimator
   */
  private updateParameters(): void {
    const estimates = this.estimator.getEstimates();

    if (estimates) {
      this.currentSigma = estimates.sigma;
      this.currentKappa = estimates.kappa;
    }

    // Use configured values if provided
    if (this.asConfig.sigma !== undefined) {
      this.currentSigma = this.asConfig.sigma;
    }
    if (this.asConfig.kappa !== undefined) {
      this.currentKappa = this.asConfig.kappa;
    }
  }

  /**
   * Log current quote
   */
  private logQuote(): void {
    if (!this.lastQuote) return;

    const q = this.lastQuote;
    const spread = q.askPrice - q.bidPrice;
    const reservationOffset = q.reservationPrice - q.midPrice;

    console.log('\n' + '='.repeat(70));
    console.log(`📊 AS Quote | ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(70));
    console.log(`Mid Price:           ${q.midPrice.toFixed(2)}`);
    console.log(`Reservation Price:   ${q.reservationPrice.toFixed(2)} (${reservationOffset >= 0 ? '+' : ''}${reservationOffset.toFixed(2)})`);
    console.log(`Half Spread:         ${q.halfSpread.toFixed(4)}`);
    console.log(`Bid:                 \x1b[32m${q.bidPrice.toFixed(2)}\x1b[0m`);
    console.log(`Ask:                 \x1b[31m${q.askPrice.toFixed(2)}\x1b[0m`);
    console.log(`Spread:              ${spread.toFixed(2)}`);
    console.log('-'.repeat(70));
    console.log(`Inventory:           ${q.inventory.toFixed(6)}`);
    console.log(`Inventory Ratio:     ${(this.positionManager.inventoryRatio * 100).toFixed(1)}%`);
    console.log(`Unrealized PnL:      ${this.positionManager.unrealizedPnl.toFixed(2)}`);
    console.log(`Realized PnL:        ${this.positionManager.realizedPnl.toFixed(2)}`);
    console.log('-'.repeat(70));
    console.log(`Gamma:               ${q.gamma.toFixed(4)}`);
    console.log(`Kappa:               ${q.kappa.toFixed(6)}`);
    console.log(`Sigma:               ${q.sigma.toFixed(6)}`);
    console.log('='.repeat(70));
  }

  /**
   * Manage orders based on calculated prices
   */
  private async manageOrders(bidPrice: number, askPrice: number): Promise<void> {
    if (this.asConfig.dryRun) {
      logger.debug(`[DRY RUN] Would place orders: BID ${bidPrice}, ASK ${askPrice}`);
      return;
    }

    // Check position limits
    const canBid = this.positionManager.canBuy(this.asConfig.orderSize);
    const canAsk = this.positionManager.canSell(this.asConfig.orderSize);

    // Manage bid order
    if (canBid) {
      await this.updateOrCreateOrder('BUY', bidPrice, this.asConfig.orderSize);
    } else {
      if (this.bidOrderId) {
        await this.cancelOrder(this.bidOrderId);
        this.bidOrderId = null;
      }
      logger.info(`Max long reached (${this.positionManager.currentInventory.toFixed(4)}), skipping bid`);
    }

    // Manage ask order
    if (canAsk) {
      await this.updateOrCreateOrder('SELL', askPrice, this.asConfig.orderSize);
    } else {
      if (this.askOrderId) {
        await this.cancelOrder(this.askOrderId);
        this.askOrderId = null;
      }
      logger.info(`Max short reached (${this.positionManager.currentInventory.toFixed(4)}), skipping ask`);
    }
  }

  /**
   * Update existing order or create new one
   */
  private async updateOrCreateOrder(
    side: OrderSide,
    price: number,
    quantity: number
  ): Promise<void> {
    const orderId = side === 'BUY' ? this.bidOrderId : this.askOrderId;

    try {
      if (orderId) {
        // Check if order still exists and is open
        const existingOrder = await this._exchange.getOrder(this.asConfig.symbol, orderId);

        if (existingOrder && existingOrder.status === 'NEW') {
          // Check if price needs adjustment
          const priceDiff = Math.abs(existingOrder.price - price);
          const minPriceMove = this.asConfig.tickSize;

          if (priceDiff >= minPriceMove) {
            // Cancel and replace
            await this.cancelOrder(orderId);
            const newOrderId = await this.placeOrder(side, price, quantity);

            if (side === 'BUY') {
              this.bidOrderId = newOrderId;
            } else {
              this.askOrderId = newOrderId;
            }
          }
        } else if (existingOrder && existingOrder.status === 'FILLED') {
          // Order filled, update position
          this.positionManager.updateFromOrder(existingOrder);
          this._stats.totalOrdersFilled++;

          // Place new order
          const newOrderId = await this.placeOrder(side, price, quantity);

          if (side === 'BUY') {
            this.bidOrderId = newOrderId;
          } else {
            this.askOrderId = newOrderId;
          }

          this.emitEvent('ORDER_FILLED', { order: existingOrder });
        } else {
          // Order cancelled or expired, place new
          const newOrderId = await this.placeOrder(side, price, quantity);

          if (side === 'BUY') {
            this.bidOrderId = newOrderId;
          } else {
            this.askOrderId = newOrderId;
          }
        }
      } else {
        // No existing order, place new
        const newOrderId = await this.placeOrder(side, price, quantity);

        if (side === 'BUY') {
          this.bidOrderId = newOrderId;
        } else {
          this.askOrderId = newOrderId;
        }
      }
    } catch (error) {
      logger.error(`Error managing ${side} order:`, error);
    }
  }

  /**
   * Place a new order
   */
  private async placeOrder(
    side: OrderSide,
    price: number,
    quantity: number
  ): Promise<string | null> {
    try {
      const roundedQty = roundToTickSize(quantity, this.asConfig.lotSize, 'down');
      const roundedPrice = roundToTickSize(price, this.asConfig.tickSize, 'nearest');

      if (roundedQty <= 0) {
        logger.warn(`Invalid quantity: ${roundedQty}`);
        return null;
      }

      const order = await this._exchange.placeOrder({
        symbol: this.asConfig.symbol,
        side,
        type: 'LIMIT',
        quantity: roundedQty,
        price: roundedPrice,
        timeInForce: 'GTC',
      });

      this._stats.totalOrdersPlaced++;
      this.emitEvent('ORDER_PLACED', { order });

      logger.info(`Placed ${side} order: ${roundedQty} @ ${roundedPrice}`);

      return order.orderId;
    } catch (error) {
      logger.error(`Failed to place ${side} order:`, error);
      return null;
    }
  }

  /**
   * Cancel an order
   */
  private async cancelOrder(orderId: string): Promise<void> {
    try {
      await this._exchange.cancelOrder(this.asConfig.symbol, orderId);
      this.emitEvent('ORDER_CANCELLED', { orderId });
    } catch (error) {
      logger.error('Failed to cancel order:', error);
    }
  }

  /**
   * Cancel all orders
   */
  private async cancelAllOrders(): Promise<void> {
    try {
      await this._exchange.cancelAllOrders(this.asConfig.symbol);
      this.bidOrderId = null;
      this.askOrderId = null;
    } catch (error) {
      logger.error('Failed to cancel all orders:', error);
    }
  }

  /**
   * Get current AS quote
   */
  getLastQuote(): ASQuote | null {
    return this.lastQuote;
  }

  /**
   * Get position manager
   */
  getPositionManager(): PositionManager {
    return this.positionManager;
  }
}

export * from './types.js';
export * from './config.js';
export * from './core.js';
export * from './calculator.js';
export * from './position.js';

export default AvellanedaStoikovStrategy;
