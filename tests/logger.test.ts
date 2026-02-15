/**
 * Logger 模块单元测试
 *
 * 运行命令:
 *   pnpm test tests/logger.test.ts     # 交互模式
 *   pnpm test:run tests/logger.test.ts # 单次运行
 *
 * 测试覆盖:
 *   - Logger 实例创建
 *   - 日志级别过滤
 *   - 不同级别日志输出
 *   - 订单簿格式化显示
 *   - 订单簿统计信息显示
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  LogLevel,
  createLogger,
  logger as defaultLogger,
} from '../src/utils/logger.js';

describe('Logger Module', () => {
  // 保存原始的console方法
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
  };

  // 每个测试前的设置
  beforeEach(() => {
    // Mock console方法
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.debug = vi.fn();
  });

  // 每个测试后的清理
  afterEach(() => {
    // 恢复原始的console方法
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.debug = originalConsole.debug;
  });

  /**
   * 测试: 创建Logger实例
   */
  it('应该能创建带有自定义配置的Logger实例', () => {
    const customLogger = createLogger({
      level: LogLevel.DEBUG,
      prefix: '[Test]',
      enableTimestamp: false,
    });

    expect(customLogger).toBeInstanceOf(Logger);
  });

  /**
   * 测试: 默认logger实例存在
   */
  it('应该导出一个默认的logger实例', () => {
    expect(defaultLogger).toBeInstanceOf(Logger);
  });

  /**
   * 测试: Logger可以记录不同级别的日志
   */
  it('应该能记录info级别的日志', () => {
    const testLogger = createLogger({
      level: LogLevel.INFO,
      enableTimestamp: false,
    });

    testLogger.info('测试消息');

    expect(console.log).toHaveBeenCalled();
  });

  /**
   * 测试: 日志级别过滤
   */
  it('应该根据日志级别过滤日志', () => {
    const errorLogger = createLogger({
      level: LogLevel.ERROR,
      enableTimestamp: false,
    });

    // ERROR级别应该过滤掉INFO日志
    errorLogger.info('这条不应该显示');
    errorLogger.error('这条应该显示');

    // console.log不应该被调用(因为INFO级别低于ERROR)
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  /**
   * 测试: 格式化订单簿数据
   */
  it('应该能格式化并显示订单簿数据', () => {
    const testLogger = createLogger({ enableTimestamp: false });

    const mockOrderBook = {
      symbol: 'BTCUSDT',
      lastUpdateId: 12345,
      bids: [
        { price: '50000.00', quantity: '1.5' },
        { price: '49900.00', quantity: '2.0' },
      ],
      asks: [
        { price: '50100.00', quantity: '1.0' },
        { price: '50200.00', quantity: '0.5' },
      ],
    };

    testLogger.displayOrderBook(mockOrderBook, 2);

    expect(console.log).toHaveBeenCalled();
  });

  /**
   * 测试: 显示订单簿统计信息
   */
  it('应该能显示订单簿统计信息', () => {
    const testLogger = createLogger({ enableTimestamp: false });

    const mockOrderBook = {
      symbol: 'BTCUSDT',
      lastUpdateId: 12345,
      bids: [{ price: '50000.00', quantity: '1.5' }],
      asks: [{ price: '50100.00', quantity: '1.0' }],
    };

    testLogger.displayOrderBookStats(mockOrderBook);

    expect(console.log).toHaveBeenCalled();
  });
});
