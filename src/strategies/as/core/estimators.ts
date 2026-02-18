/**
 * Avellaneda-Stoikov Parameter Estimators
 *
 * Calculates sigma (volatility) and kappa (order arrival intensity)
 * from market data
 */
import { Candle, OrderBook } from '../../../exchanges/interface.js';
import { RingBuffer } from '../../../utils/ring-buffer.js';

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

  addPrice(price: number): void {
    const prevPrice = this.priceBuffer.peekBack();
    this.priceBuffer.push(price);

    if (prevPrice != null && prevPrice !== 0) {
      const logReturn = Math.log(price / prevPrice);
      this.returnsBuffer.push(logReturn);
    }
  }

  addCandles(candles: Candle[]): void {
    for (const candle of candles) {
      this.addPrice(candle.close);
    }
  }

  calculate(): number | null {
    const returns = this.returnsBuffer.toArray();
    if (returns.length < 2) return null;

    return this.useEwma
      ? this.calculateEwmaVolatility(returns)
      : this.calculateStandardDeviation(returns);
  }

  private calculateStandardDeviation(returns: number[]): number {
    const n = returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / n;
    const variance = returns.reduce((sum, r) => {
      const diff = r - mean;
      return sum + diff * diff;
    }, 0) / (n - 1);
    return Math.sqrt(variance);
  }

  private calculateEwmaVolatility(returns: number[]): number {
    if (this.lastEwma === 0) {
      const variance = this.calculateStandardDeviation(returns);
      this.lastEwma = variance * variance;
    }
    const latestReturn = returns[returns.length - 1];
    const squaredReturn = latestReturn * latestReturn;
    this.lastEwma = this.ewmaDecay * this.lastEwma + (1 - this.ewmaDecay) * squaredReturn;
    return Math.sqrt(this.lastEwma);
  }

  getCount(): number { return this.returnsBuffer.size(); }
  isReady(minSamples: number = 10): boolean { return this.returnsBuffer.size() >= minSamples; }

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

  constructor(window: number = 50) {
    this.spreadBuffer = new RingBuffer<number>(window);
    this.midPriceBuffer = new RingBuffer<number>(window);
  }

  addOrderBook(orderBook: OrderBook): void {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) return;

    const bestBid = orderBook.bids[0].price;
    const bestAsk = orderBook.asks[0].price;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPercent = (bestAsk - bestBid) / midPrice;

    this.midPriceBuffer.push(midPrice);
    this.spreadBuffer.push(spreadPercent);
  }

  calculate(spreadMultiplier: number = 2.0): number | null {
    const spreads = this.spreadBuffer.toArray();
    if (spreads.length < 5) return null;

    const avgSpread = spreads.reduce((sum, s) => sum + s, 0) / spreads.length;
    if (avgSpread <= 0) return null;

    const kappa = 1 / (avgSpread * spreadMultiplier);
    return Math.max(0.001, Math.min(0.5, kappa));
  }

  calculateFromVolatility(sigma: number): number {
    if (sigma <= 0) return 0.01;
    const kappa = sigma / 10;
    return Math.max(0.001, Math.min(0.5, kappa));
  }

  getCount(): number { return this.spreadBuffer.size(); }
  isReady(minSamples: number = 5): boolean { return this.spreadBuffer.size() >= minSamples; }

  reset(): void {
    this.spreadBuffer.clear();
    this.midPriceBuffer.clear();
  }
}

/**
 * Combined parameter estimator
 */
export class ParameterEstimator {
  public volatility: VolatilityCalculator;
  public kappa: KappaCalculator;

  constructor(
    volatilityWindow: number = 100,
    kappaWindow: number = 50,
    useEwma: boolean = false
  ) {
    this.volatility = new VolatilityCalculator(volatilityWindow, useEwma);
    this.kappa = new KappaCalculator(kappaWindow);
  }

  processCandles(candles: Candle[]): void {
    this.volatility.addCandles(candles);
  }

  processOrderBook(orderBook: OrderBook): void {
    this.kappa.addOrderBook(orderBook);
  }

  getEstimates(kappaSpreadMultiplier: number = 2.0): { sigma: number; kappa: number } | null {
    const sigma = this.volatility.calculate();
    if (sigma === null) return null;

    let kappa = this.kappa.calculate(kappaSpreadMultiplier);
    if (kappa === null) {
      kappa = this.kappa.calculateFromVolatility(sigma);
    }
    return { sigma, kappa };
  }

  isReady(minVolatilitySamples: number = 10, minKappaSamples: number = 5): boolean {
    return this.volatility.isReady(minVolatilitySamples) || this.kappa.isReady(minKappaSamples);
  }

  reset(): void {
    this.volatility.reset();
    this.kappa.reset();
  }
}
