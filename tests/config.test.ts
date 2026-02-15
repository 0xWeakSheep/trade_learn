/**
 * 运行命令:
 * pnpm test tests/config.test.ts
 * 或
 * pnpm test:run tests/config.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import {
  TRADING_CONFIG,
  BINANCE_CONFIG,
  APP_CONFIG,
  MarketType,
  validateConfig,
  isValidDepthLimit,
} from '../src/config/index.js';

describe('Config Module', () => {
  /**
   * 测试: TRADING_CONFIG 配置正确
   */
  it('应该具有正确的交易配置默认值', () => {
    expect(TRADING_CONFIG.DEFAULT_SYMBOL).toBe('BTCUSDT');
    expect(TRADING_CONFIG.DEFAULT_DEPTH_LIMIT).toBe(20);
    expect(TRADING_CONFIG.SUPPORTED_DEPTH_LIMITS).toContain(5);
    expect(TRADING_CONFIG.SUPPORTED_DEPTH_LIMITS).toContain(20);
    expect(TRADING_CONFIG.SUPPORTED_DEPTH_LIMITS).toContain(100);
  });

  /**
   * 测试: BINANCE_CONFIG 配置正确
   */
  it('应该具有正确的API配置', () => {
    expect(BINANCE_CONFIG.BASE_URL).toBe('https://api.binance.com');
    expect(BINANCE_CONFIG.FUTURES_BASE_URL).toBe('https://fapi.binance.com');
    expect(BINANCE_CONFIG.TIMEOUT).toBe(30000);
  });

  /**
   * 测试: APP_CONFIG 配置正确
   */
  it('应该具有正确的应用配置', () => {
    expect(APP_CONFIG.NODE_ENV).toBeDefined();
    expect(APP_CONFIG.IS_DEV).toBeDefined();
    expect(APP_CONFIG.IS_PROD).toBeDefined();
  });

  /**
   * 测试: 市场类型枚举值
   */
  it('应该具有正确的市场类型枚举值', () => {
    expect(MarketType.SPOT).toBe('SPOT');
    expect(MarketType.FUTURES).toBe('FUTURES');
  });

  /**
   * 测试: isValidDepthLimit 函数
   */
  it('应该正确验证深度限制值', () => {
    expect(isValidDepthLimit(5)).toBe(true);
    expect(isValidDepthLimit(20)).toBe(true);
    expect(isValidDepthLimit(100)).toBe(true);
    expect(isValidDepthLimit(999)).toBe(false);
    expect(isValidDepthLimit(0)).toBe(false);
  });
});
