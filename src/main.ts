/**
 * Main entry point for trading bot
 *
 * Run commands:
 * - pnpm dev                    # Run AS strategy in dry-run mode (default)
 * - pnpm dev --mode=market-maker  # Run AS market maker
 * - pnpm dev --mode=orderbook   # Run order book viewer
 * - pnpm dev --live             # Run AS strategy with real orders (BE CAREFUL!)
 */
import { createLogger } from './utils/logger.js';
import { ExchangeFactory, ExchangeType } from './exchanges/factory.js';
import {
  AvellanedaStoikovStrategy,
  createASConfig,
  AS_PRESETS,
} from './strategies/as/index.js';
import { IStrategy, StrategyConfig } from './strategies/interface.js';
import { MarketType } from './config/index.js';
import { BINANCE_CONFIG } from './config/index.js';

const logger = createLogger({ prefix: '[Main]' });

/**
 * CLI Arguments
 */
interface CliArgs {
  mode: 'market-maker' | 'orderbook';
  symbol: string;
  exchange: string;
  preset: keyof typeof AS_PRESETS;
  dryRun: boolean;
  gamma?: number;
  orderSize: number;
  maxPosition: number;
  updateInterval: number;
  help: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  const result: CliArgs = {
    mode: 'market-maker',
    symbol: 'BTCUSDT',
    exchange: 'binance',
    preset: 'moderate',
    dryRun: true,
    orderSize: 0.001,
    maxPosition: 0.01,
    updateInterval: 1000,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        result.help = true;
        break;

      case '--mode':
        const mode = args[++i];
        if (mode === 'market-maker' || mode === 'orderbook') {
          result.mode = mode;
        }
        break;

      case '--symbol':
      case '-s':
        result.symbol = (args[++i] || 'BTCUSDT').toUpperCase();
        break;

      case '--exchange':
      case '-e':
        result.exchange = args[++i] || 'binance';
        break;

      case '--preset':
      case '-p':
        const preset = args[++i] as keyof typeof AS_PRESETS;
        if (preset in AS_PRESETS) {
          result.preset = preset;
        }
        break;

      case '--live':
        result.dryRun = false;
        break;

      case '--dry-run':
        result.dryRun = true;
        break;

      case '--gamma':
      case '-g':
        result.gamma = parseFloat(args[++i] || '0.5');
        break;

      case '--order-size':
      case '-o':
        result.orderSize = parseFloat(args[++i] || '0.001');
        break;

      case '--max-position':
      case '-m':
        result.maxPosition = parseFloat(args[++i] || '0.01');
        break;

      case '--interval':
      case '-i':
        result.updateInterval = parseInt(args[++i] || '1000', 10);
        break;
    }
  }

  return result;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║           Avellaneda-Stoikov Market Maker Trading Bot                ║
╚══════════════════════════════════════════════════════════════════════╝

Usage: pnpm dev [options]

Modes:
  --mode market-maker    Run AS market maker strategy (default)
  --mode orderbook       Run order book viewer only

Options:
  -s, --symbol <symbol>     Trading pair (default: BTCUSDT)
  -e, --exchange <type>     Exchange type (default: binance)
  -p, --preset <preset>     Strategy preset: conservative|moderate|aggressive
  -g, --gamma <value>       Risk aversion parameter (overrides preset)
  -o, --order-size <size>   Base order size (default: 0.001)
  -m, --max-position <pos>  Max position limit (default: 0.01)
  -i, --interval <ms>       Update interval in ms (default: 1000)
  --live                    Enable live trading (NOT dry-run)
  --dry-run                 Enable dry-run mode (default)
  -h, --help                Show this help message

Examples:
  # Run in dry-run mode with default settings
  pnpm dev

  # Run with aggressive preset on ETH
  pnpm dev -s ETHUSDT -p aggressive

  # Run in live mode (BE CAREFUL!)
  pnpm dev --live -s BTCUSDT

  # Run order book viewer
  pnpm dev --mode orderbook -s BTCUSDT

  # Custom gamma and order size
  pnpm dev -g 0.3 -o 0.01 -m 0.1

Safety Notes:
  - Dry-run mode is enabled by default for safety
  - Use --live only when you understand the risks
  - Always set appropriate position limits
  - Monitor the strategy closely when running live
`);
}

/**
 * Run AS Market Maker Strategy
 */
async function runMarketMaker(args: CliArgs): Promise<void> {
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('   Avellaneda-Stoikov Market Maker Strategy');
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`Symbol:        ${args.symbol}`);
  logger.info(`Exchange:      ${args.exchange}`);
  logger.info(`Preset:        ${args.preset}`);
  logger.info(`Dry Run:       ${args.dryRun}`);
  logger.info(`Order Size:    ${args.orderSize}`);
  logger.info(`Max Position:  ${args.maxPosition}`);
  logger.info(`Update Int:    ${args.updateInterval}ms`);

  if (!args.dryRun) {
    logger.warn('⚠️  LIVE TRADING MODE - REAL ORDERS WILL BE PLACED!');
    logger.warn('⚠️  Press Ctrl+C within 3 seconds to cancel...');
    await sleep(3000);
  }

  // Check for API keys
  if (!BINANCE_CONFIG.API_KEY || !BINANCE_CONFIG.SECRET_KEY) {
    logger.warn('No API keys found. Running in simulation mode.');
  }

  // Create exchange
  logger.info(`Connecting to ${args.exchange}...`);
  const exchange = ExchangeFactory.create(args.exchange);
  logger.info('Exchange connected');

  // Get market info for precision
  const orderBook = await exchange.getOrderBook(args.symbol, 5);
  const midPrice = (orderBook.bids[0].price + orderBook.asks[0].price) / 2;
  logger.info(`Current price: ${midPrice.toFixed(2)}`);

  // Create strategy config
  const presetConfig = AS_PRESETS[args.preset];
  const asConfig = createASConfig({
    symbol: args.symbol,
    baseAsset: args.symbol.replace(/USDT|BUSD|USDC$/, ''),
    quoteAsset: 'USDT',
    gamma: args.gamma ?? presetConfig.gamma,
    orderSize: args.orderSize,
    maxPosition: args.maxPosition,
    minPosition: -args.maxPosition,
    updateIntervalMs: args.updateInterval,
    dryRun: args.dryRun,
    // Estimate tick size from order book
    tickSize: 0.01,
    lotSize: 0.0001,
  });

  // Create base strategy config
  const strategyConfig: StrategyConfig = {
    name: `AS-${args.symbol}`,
    symbol: args.symbol,
    quoteAsset: asConfig.quoteAsset,
    baseAsset: asConfig.baseAsset,
    orderSize: asConfig.orderSize,
    tickSize: asConfig.tickSize,
    lotSize: asConfig.lotSize,
    maxPosition: asConfig.maxPosition,
    minPosition: asConfig.minPosition,
    updateIntervalMs: asConfig.updateIntervalMs,
    dryRun: asConfig.dryRun,
  };

  // Create and run strategy
  const strategy = new AvellanedaStoikovStrategy();
  await strategy.initialize(exchange, strategyConfig);

  // Handle events
  strategy.on('ORDER_FILLED', (event) => {
    logger.info('Order filled:', event.data);
  });

  strategy.on('ERROR', (event) => {
    logger.error('Strategy error:', event.data);
  });

  // Start strategy
  await strategy.start();

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('\nReceived SIGINT, shutting down gracefully...');
    await strategy.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('\nReceived SIGTERM, shutting down gracefully...');
    await strategy.stop();
    process.exit(0);
  });
}

/**
 * Run Order Book Viewer
 */
async function runOrderBook(args: CliArgs): Promise<void> {
  const { BinanceService } = await import('./services/binance.service.js');

  const binanceService = new BinanceService(MarketType.SPOT);
  const limit = 20;

  logger.info(`Starting order book viewer for ${args.symbol}...`);

  // Clear screen function
  const clearScreen = () => {
    console.clear();
  };

  // Print order book function
  const printOrderBook = (
    symbol: string,
    bids: { price: string; quantity: string }[],
    asks: { price: string; quantity: string }[],
    displayCount: number
  ): void => {
    clearScreen();

    const count = Math.min(displayCount, bids.length, asks.length);

    console.log('='.repeat(80));
    console.log(`📊 币安订单簿 | ${symbol} | ${count}档深度 | ${new Date().toLocaleTimeString()}`);
    console.log('='.repeat(80));

    // Header
    const askHeader = `${'卖价(Ask)'.padStart(12)} ${'数量'.padStart(15)} ${'累计'.padStart(15)}`;
    const bidHeader = `${'买价(Bid)'.padStart(15)} ${'数量'.padStart(15)} ${'累计'.padStart(15)}`;
    console.log(`\x1b[31m${askHeader}\x1b[0m │ \x1b[32m${bidHeader}\x1b[0m`);
    console.log('─'.repeat(80));

    // Calculate cumulative
    let askCumulative = 0;
    let bidCumulative = 0;
    const askCumulatives: number[] = [];
    const bidCumulatives: number[] = [];

    for (let i = 0; i < count; i++) {
      askCumulative += parseFloat(asks[i].quantity);
      bidCumulative += parseFloat(bids[i].quantity);
      askCumulatives.push(askCumulative);
      bidCumulatives.push(bidCumulative);
    }

    // Print data
    for (let i = count - 1; i >= 0; i--) {
      const askPrice = parseFloat(asks[i].price);
      const askQty = parseFloat(asks[i].quantity);
      const bidPrice = parseFloat(bids[i].price);
      const bidQty = parseFloat(bids[i].quantity);

      const askPart = `${askPrice.toFixed(2).padStart(12)} ${askQty.toFixed(4).padStart(15)} ${askCumulatives[i].toFixed(4).padStart(15)}`;
      const bidPart = `${bidPrice.toFixed(2).padStart(15)} ${bidQty.toFixed(4).padStart(15)} ${bidCumulatives[i].toFixed(4).padStart(15)}`;

      console.log(`\x1b[31m${askPart}\x1b[0m │ ${bidPart}`);
    }

    console.log('─'.repeat(80));
    const bestAsk = parseFloat(asks[0].price);
    const bestBid = parseFloat(bids[0].price);
    const spread = bestAsk - bestBid;
    const spreadPercent = (spread / bestBid) * 100;

    console.log(
      `卖一: \x1b[31m${bestAsk.toFixed(2)}\x1b[0m | ` +
      `买一: \x1b[32m${bestBid.toFixed(2)}\x1b[0m | ` +
      `价差: \x1b[33m${spread.toFixed(2)} (${spreadPercent.toFixed(4)}%)\x1b[0m`
    );
    console.log('='.repeat(80));
    console.log('按 Ctrl+C 退出');
  };

  // Initial fetch
  const initialData = await binanceService.getOrderBook(args.symbol, limit);
  printOrderBook(args.symbol, initialData.bids, initialData.asks, limit);

  // Start update loop
  const intervalId = setInterval(async () => {
    try {
      const data = await binanceService.getOrderBook(args.symbol, limit);
      printOrderBook(args.symbol, data.bids, data.asks, limit);
    } catch (error) {
      logger.error('Refresh failed:', error);
    }
  }, 1000);

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\n正在关闭...');
    clearInterval(intervalId);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(intervalId);
    process.exit(0);
  });
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  try {
    switch (args.mode) {
      case 'market-maker':
        await runMarketMaker(args);
        break;
      case 'orderbook':
        await runOrderBook(args);
        break;
      default:
        logger.error(`Unknown mode: ${args.mode}`);
        process.exit(1);
    }
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run main
main();
