/**
 * Avellaneda-Stoikov Parameter Calculators
 *
 * Calculates sigma (volatility) and kappa (order arrival intensity)
 * from market data
 */
import { Candle, OrderBook } from '../../exchanges/interface.js';
import { RingBuffer } from '../../utils/ring-buffer.js';

/**
 * Volatility calculator
 * Computes rolling volatility from price data
 */
export class VolatilityCalculator {
  private priceBuffer: RingBuffer<number>;
  private returnsBuffer: RingBuffer<number>;
  private useEwma: boolean;
  private ewmaDecay: number;
  private lastEwma: number = 0;

  /**
   * Create volatility calculator
   * @param window Window size for calculation
   * @param useEwma Use EWMA instead of simple moving average
   * @param ewmaDecay EWMA decay factor (0-1)
   */
  constructor(
    window: number = 100,
    useEwma: boolean = false,
    ewmaDecay: number = 0.94
  ) {
    this.priceBuffer = new RingBuffer<number>(window);
    this.returnsBuffer = new RingBuffer<number>(window - 1);
    this.useEwma = useEwma;
    this.ewmaDecay = ewmaDecay;
  }

  /**
   * Add a price point
   * @param price Price to add
   */
  addPrice(price: number): void {
    const prevPrice = this.priceBuffer.peekBack();
    this.priceBuffer.push(price);

    if (prevPrice != null && prevPrice !== 0) {
      const logReturn = Math.log(price / prevPrice);
      this.returnsBuffer.push(logReturn);
    }
  }

  /**
   * Add candle data
   * @param candles Array of candles
   */
  addCandles(candles: Candle[]): void {
    for (const candle of candles) {
      // Use close price for volatility calculation
      this.addPrice(candle.close);
    }
  }

  /**
   * Calculate current volatility (sigma)
   *
   * Returns the standard deviation of log returns.
   * For intraday trading, no annualization is applied.
   *
   * @returns Volatility estimate (sigma), or null if insufficient data
   */
  calculate(): number | null {
    const returns = this.returnsBuffer.toArray();

    if (returns.length < 2) {
      return null;
    }

    if (this.useEwma) {
      return this.calculateEwmaVolatility(returns);
    } else {
      return this.calculateStandardDeviation(returns);
    }
  }

  /**
   * Calculate standard deviation (simple)
   */
  private calculateStandardDeviation(returns: number[]): number {
    const n = returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / n;

    const variance = returns.reduce((sum, r) => {
      const diff = r - mean;
      return sum + diff * diff;
    }, 0) / (n - 1); // Use n-1 for sample variance

    return Math.sqrt(variance);
  }

  /**
   * Calculate EWMA volatility
   */
  private calculateEwmaVolatility(returns: number[]): number {
    if (this.lastEwma === 0) {
      // Initialize with standard variance
      const variance = this.calculateStandardDeviation(returns);
      this.lastEwma = variance * variance;
    }

    // Update EWMA with latest return
    const latestReturn = returns[returns.length - 1];
    const squaredReturn = latestReturn * latestReturn;

    // EWMA update: σ²_t = λ * σ²_{t-1} + (1-λ) * r²_t
    this.lastEwma = this.ewmaDecay * this.lastEwma + (1 - this.ewmaDecay) * squaredReturn;

    return Math.sqrt(this.lastEwma);
  }

  /**
   * Get number of data points
   */
  getCount(): number {
    return this.returnsBuffer.size();
  }

  /**
   * Check if calculator has enough data
   */
  isReady(minSamples: number = 10): boolean {
    return this.returnsBuffer.size() >= minSamples;
  }

  /**
   * Reset calculator
   */
  reset(): void {
    this.priceBuffer.clear();
    this.returnsBuffer.clear();
    this.lastEwma = 0;
  }
}

/**
 * Kappa calculator
 * Estimates order arrival intensity from order book data
 */
export class KappaCalculator {
  private spreadBuffer: RingBuffer<number>;
  private midPriceBuffer: RingBuffer<number>;

  /**
   * Create kappa calculator
   * @param window Window size for calculation
   */
  constructor(window: number = 50) {
    this.spreadBuffer = new RingBuffer<number>(window);
    this.midPriceBuffer = new RingBuffer<number>(window);
  }

  /**
   * Add order book data
   * @param orderBook Order book snapshot
   */
  addOrderBook(orderBook: OrderBook): void {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      return;
    }

    const bestBid = orderBook.bids[0].price;
    const bestAsk = orderBook.asks[0].price;
    const midPrice = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    const spreadPercent = spread / midPrice;

    this.midPriceBuffer.push(midPrice);
    this.spreadBuffer.push(spreadPercent);
  }

  /**
   * Add raw spread data
   * @param spread Bid-ask spread (absolute or percentage)
 */
  addSpread(spread: number): void {
    this.spreadBuffer.push(spread);
  }

  /**
   * Calculate kappa estimate
   *
   * Kappa represents the sensitivity of order arrival rate to distance
   * from mid price. We estimate it heuristically based on observed spreads.
   *
   * Heuristic: κ ≈ 1 / (average_spread * multiplier)
   *
   * The intuition is that in markets with tighter spreads, order flow
   * is more sensitive to price (higher kappa).
   *
   * @param spreadMultiplier Multiplier to convert average spread to kappa
   * @returns Kappa estimate, or null if insufficient data
   */
  calculate(spreadMultiplier: number = 2.0): number | null {
    const spreads = this.spreadBuffer.toArray();

    if (spreads.length < 5) {
      return null;
    }

    // Calculate average spread
    const avgSpread = spreads.reduce((sum, s) => sum + s, 0) / spreads.length;

    if (avgSpread <= 0) {
      return null;
    }

    // Heuristic: kappa is inversely proportional to spread
    // Higher spread = lower kappa (less sensitive order flow)
    // Lower spread = higher kappa (more sensitive order flow)
    const kappa = 1 / (avgSpread * spreadMultiplier);

    // Clamp to reasonable range
    return Math.max(0.001, Math.min(0.5, kappa));
  }

  /**
   * Calculate kappa from volatility (alternative method)
   *
   * When spread data is not available, kappa can be estimated
   * from volatility. Higher volatility typically means lower kappa.
   *
   * @param sigma Volatility estimate
   * @returns Kappa estimate
   */
  calculateFromVolatility(sigma: number): number {
    if (sigma <= 0) {
      return 0.01; // Default value
    }

    // Heuristic: κ ≈ σ / C where C is a scaling constant
    // This reflects that more volatile markets have less sensitive order flow
    const kappa = sigma / 10;

    return Math.max(0.001, Math.min(0.5, kappa));
  }

  /**
   * Get number of data points
   */
  getCount(): number {
    return this.spreadBuffer.size();
  }

  /**
   * Check if calculator has enough data
   */
  isReady(minSamples: number = 5): boolean {
    return this.spreadBuffer.size() >= minSamples;
  }

  /**
   * Get average spread
   */
  getAverageSpread(): number | null {
    const spreads = this.spreadBuffer.toArray();
    if (spreads.length === 0) {
      return null;
    }
    return spreads.reduce((sum, s) => sum + s, 0) / spreads.length;
  }

  /**
   * Reset calculator
   */
  reset(): void {
    this.spreadBuffer.clear();
    this.midPriceBuffer.clear();
  }
}

/**
 * Combined parameter estimator
 * Manages both sigma and kappa calculators
 */
export class ParameterEstimator {
  public volatility: VolatilityCalculator;
  public kappa: KappaCalculator;

  /**
   * Create parameter estimator
   * @param volatilityWindow Window for volatility calculation
   * @param kappaWindow Window for kappa calculation
   * @param useEwma Use EWMA for volatility
   */
  constructor(
    volatilityWindow: number = 100,
    kappaWindow: number = 50,
    useEwma: boolean = false
  ) {
    this.volatility = new VolatilityCalculator(volatilityWindow, useEwma);
    this.kappa = new KappaCalculator(kappaWindow);
  }

  /**
   * Process candle data for volatility calculation
   */
  processCandles(candles: Candle[]): void {
    this.volatility.addCandles(candles);
  }

  /**
   * Process order book for kappa calculation
   */
  processOrderBook(orderBook: OrderBook): void {
    this.kappa.addOrderBook(orderBook);
  }

  /**
   * Get current parameter estimates
   * @param kappaSpreadMultiplier Multiplier for kappa calculation
   * @returns Object with sigma and kappa, or null if not ready
   */
  getEstimates(kappaSpreadMultiplier: number = 2.0): { sigma: number; kappa: number } | null {
    const sigma = this.volatility.calculate();

    if (sigma === null) {
      return null;
    }

    // Try to get kappa from spreads, fall back to volatility-based estimate
    let kappa = this.kappa.calculate(kappaSpreadMultiplier);

    if (kappa === null) {
      kappa = this.kappa.calculateFromVolatility(sigma);
    }

    return { sigma, kappa };
  }

  /**
   * Check if estimator has enough data
   */
  isReady(minVolatilitySamples: number = 10, minKappaSamples: number = 5): boolean {
    return (
      this.volatility.isReady(minVolatilitySamples) ||
      this.kappa.isReady(minKappaSamples)
    );
  }

  /**
   * Reset all calculators
   */
  reset(): void {
    this.volatility.reset();
    this.kappa.reset();
  }
}
