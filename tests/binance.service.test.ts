/**
 * 运行命令:
 * pnpm test tests/binance.service.test.ts
 * 或
 * pnpm test:run tests/binance.service.test.ts
 */
/**
 * BinanceService 单元测试
 *
 * 运行命令:
 *   pnpm test tests/binance.service.test.ts     # 交互模式
 *   pnpm test:run tests/binance.service.test.ts # 单次运行
 *
 * 测试覆盖:
 *   - 服务实例创建
 *   - 市场类型设置与切换
 *   - 错误类功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BinanceService, BinanceServiceError } from '../src/services/binance.service.js';
import { MarketType } from '../src/config/index.js';

describe('BinanceService', () => {
  let service: BinanceService;

  beforeEach(() => {
    service = new BinanceService(MarketType.SPOT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试: 服务实例创建
   */
  it('应该能创建服务实例', () => {
    expect(service).toBeInstanceOf(BinanceService);
  });

  /**
   * 测试: 默认市场类型为SPOT
   */
  it('默认市场类型应该是SPOT', () => {
    const defaultService = new BinanceService();
    expect(defaultService.getMarketType()).toBe('SPOT');
  });

  /**
   * 测试: 可以设置市场类型为FUTURES
   */
  it('应该能设置市场类型为FUTURES', () => {
    const futuresService = new BinanceService('FUTURES');
    expect(futuresService.getMarketType()).toBe('FUTURES');
  });

  /**
   * 测试: 可以切换市场类型
   */
  it('应该能切换市场类型', () => {
    service.setMarketType('FUTURES');
    expect(service.getMarketType()).toBe('FUTURES');
  });

  /**
   * 测试: 错误类实例化
   */
  it('应该能创建BinanceServiceError实例', () => {
    const error = new BinanceServiceError('测试错误');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BinanceServiceError');
    expect(error.message).toBe('测试错误');
  });
});
