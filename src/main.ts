/**
 * 运行命令:
 * pnpm dev
 * 或
 * pnpm ts-node src/main.ts
 */
import { BINANCE_CONFIG, TRADING_CONFIG, APP_CONFIG } from './config/index.js';
import { logger, createLogger } from './utils/logger.js';
import { BinanceService, type MarketType } from './services/binance.service.js';

// 创建专用logger
const mainLogger = createLogger({ prefix: '[Main]' });

/**
 * 从命令行参数解析配置
 */
function parseArgs(): { symbol: string; limit: number; marketType: MarketType } {
  const args = process.argv.slice(2);

  let symbol = TRADING_CONFIG.DEFAULT_SYMBOL;
  let limit = 20; // 默认显示前20档
  let marketType: MarketType = 'SPOT';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--symbol':
      case '-s':
        symbol = args[++i]?.toUpperCase() || symbol;
        break;
      case '--limit':
      case '-l':
        limit = parseInt(args[++i], 10) || limit;
        break;
      case '--futures':
      case '-f':
        marketType = 'FUTURES';
        break;
      case '--spot':
        marketType = 'SPOT';
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return { symbol, limit, marketType };
}

/**
 * 打印帮助信息
 */
function printHelp(): void {
  console.log(`
币安订单簿实时监控工具

用法: pnpm dev [选项]

选项:
  -s, --symbol <symbol>   交易对 (默认: BTCUSDT)
  -l, --limit <number>    显示深度数量 (默认: 20)
  -f, --futures           使用合约市场
  --spot                  使用现货市场 (默认)
  -h, --help              显示帮助信息

示例:
  pnpm dev                          # 默认: BTCUSDT 现货 20档
  pnpm dev --symbol ETHUSDT         # 查看ETH/USDT
  pnpm dev -s ETHUSDT -l 10         # 查看ETH/USDT前10档
  pnpm dev --futures                # 查看合约市场
  pnpm dev -s BTCUSDT -f -l 50      # 查看BTC合约前50档
`);
}

/**
 * 清屏函数
 */
function clearScreen(): void {
  console.clear();
}

/**
 * 打印订单簿
 */
function printOrderBook(
  symbol: string,
  bids: { price: string; quantity: string }[],
  asks: { price: string; quantity: string }[],
  displayCount: number
): void {
  clearScreen();

  const count = Math.min(displayCount, bids.length, asks.length);

  console.log('='.repeat(80));
  console.log(`📊 币安订单簿 | ${symbol} | ${count}档深度 | ${new Date().toLocaleTimeString()}`);
  console.log('='.repeat(80));

  // 表头
  console.log(
    '\x1b[31m%12s %15s %15s %10s\x1b[0m │ \x1b[32m%10s %15s %15s %12s\x1b[0m',
    '卖价(Ask)', '数量', '累计', '', '', '买价(Bid)', '数量', '累计'
  );
  console.log('─'.repeat(80));

  // 计算累计
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

  // 打印数据 - 卖盘从上到下(价高到低)，买盘从上到下(价高到低对应asks[i])
  for (let i = count - 1; i >= 0; i--) {
    const askPrice = parseFloat(asks[i].price);
    const askQty = parseFloat(asks[i].quantity);
    const bidPrice = parseFloat(bids[i].price);
    const bidQty = parseFloat(bids[i].quantity);

    console.log(
      '\x1b[31m%12.2f %15.4f %15.4f %10s\x1b[0m │ \x1b[32m%10s %15.2f %15.4f %15.4f\x1b[0m',
      askPrice,
      askQty,
      askCumulatives[i],
      '',
      '',
      bidPrice,
      bidQty,
      bidCumulatives[i]
    );
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
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const { symbol, limit, marketType } = parseArgs();

  mainLogger.info('启动币安订单簿监控...');
  mainLogger.info(`交易对: ${symbol}, 市场: ${marketType}, 深度: ${limit}`);

  // 检查API Key (可选，订单簿是公开数据)
  if (!BINANCE_CONFIG.API_KEY) {
    mainLogger.info('使用公开API模式 (无需API Key)');
  }

  // 创建服务实例
  const binanceService = new BinanceService(marketType);

  // 首次获取数据
  try {
    const initialData = await binanceService.getOrderBook(symbol, limit);
    printOrderBook(symbol, initialData.bids, initialData.asks, limit);
  } catch (error) {
    mainLogger.error('获取初始数据失败:', error);
    process.exit(1);
  }

  // 设置定时刷新
  const intervalId = setInterval(async () => {
    try {
      const data = await binanceService.getOrderBook(symbol, limit);
      printOrderBook(symbol, data.bids, data.asks, limit);
    } catch (error) {
      mainLogger.error('刷新数据失败:', error);
    }
  }, 1000); // 每秒刷新

  // 处理退出
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

// 运行应用
main().catch((error) => {
  logger.error('应用错误:', error);
  process.exit(1);
});
