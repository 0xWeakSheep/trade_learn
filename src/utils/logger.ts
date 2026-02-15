/**
 * Simple logger utility for formatting and outputting order book data
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  enableTimestamp?: boolean;
}

/**
 * Order book entry interface
 */
export interface OrderBookEntry {
  price: string;
  quantity: string;
}

/**
 * Formatted order book data
 */
export interface FormattedOrderBook {
  symbol: string;
  lastUpdateId: number;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

/**
 * Logger class for consistent output formatting
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private enableTimestamp: boolean;

  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || LogLevel.INFO;
    this.prefix = options.prefix || '[OrderBook]';
    this.enableTimestamp = options.enableTimestamp ?? true;
  }

  /**
   * Format a timestamp for log output
   */
  private getTimestamp(): string {
    if (!this.enableTimestamp) return '';
    return `[${new Date().toISOString()}]`;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return Logger.LEVEL_PRIORITY[level] >= Logger.LEVEL_PRIORITY[this.level];
  }

  /**
   * Format and output a log message
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = this.getTimestamp();
    const formattedMessage = `${timestamp}${this.prefix}[${level}] ${message}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...args);
        break;
      default:
        console.log(formattedMessage, ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  /**
   * Format and display order book data in a readable table format
   */
  displayOrderBook(orderBook: FormattedOrderBook, displayLimit: number = 10): void {
    const { symbol, lastUpdateId, bids, asks } = orderBook;

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Order Book: ${symbol} (Last Update ID: ${lastUpdateId})`);
    console.log('='.repeat(60));

    // Header
    console.log('\n' + '─'.repeat(60));
    console.log(`${'Price'.padStart(20)} | ${'Quantity'.padStart(15)} | ${'Side'.padStart(10)}`);
    console.log('─'.repeat(60));

    // Asks (sell orders) - displayed in reverse order (highest ask first)
    const sortedAsks = [...asks]
      .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
      .slice(0, displayLimit);

    for (const ask of sortedAsks) {
      console.log(
        `${ask.price.padStart(20)} | ${ask.quantity.padStart(15)} | ${'ASK'.padStart(10)}`
      );
    }

    // Spread indicator
    if (bids.length > 0 && asks.length > 0) {
      const bestBid = parseFloat(bids[0].price);
      const bestAsk = parseFloat(asks[0].price);
      const spread = bestAsk - bestBid;
      const spreadPercent = (spread / bestBid) * 100;

      console.log('─'.repeat(60));
      console.log(
        `📈 Spread: ${spread.toFixed(2)} (${spreadPercent.toFixed(4)}%) | Best Bid: ${bestBid} | Best Ask: ${bestAsk}`
      );
      console.log('─'.repeat(60));
    }

    // Bids (buy orders)
    const sortedBids = [...bids]
      .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
      .slice(0, displayLimit);

    for (const bid of sortedBids) {
      console.log(
        `${bid.price.padStart(20)} | ${bid.quantity.padStart(15)} | ${'BID'.padStart(10)}`
      );
    }

    console.log('─'.repeat(60));
    console.log(`Showing top ${displayLimit} bids and asks\n`);
  }

  /**
   * Display a compact summary of order book statistics
   */
  displayOrderBookStats(orderBook: FormattedOrderBook): void {
    const { symbol, bids, asks } = orderBook;

    const totalBidVolume = bids.reduce(
      (sum, bid) => sum + parseFloat(bid.quantity),
      0
    );
    const totalAskVolume = asks.reduce(
      (sum, ask) => sum + parseFloat(ask.quantity),
      0
    );

    const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : 0;
    const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : 0;
    const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : 0;

    console.log('\n' + '─'.repeat(40));
    console.log(`📊 ${symbol} Order Book Stats`);
    console.log('─'.repeat(40));
    console.log(`Best Bid:     ${bestBid.toFixed(2)}`);
    console.log(`Best Ask:     ${bestAsk.toFixed(2)}`);
    console.log(`Mid Price:    ${midPrice.toFixed(2)}`);
    console.log(`Total Bids:   ${bids.length}`);
    console.log(`Total Asks:   ${asks.length}`);
    console.log(`Bid Volume:   ${totalBidVolume.toFixed(6)}`);
    console.log(`Ask Volume:   ${totalAskVolume.toFixed(6)}`);
    console.log('─'.repeat(40) + '\n');
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a new logger instance with custom options
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}
