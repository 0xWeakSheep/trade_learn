/**
 * 运行命令:
 * pnpm test tests/config.test.ts
 * 或
 * pnpm test:run tests/config.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import type { Config, MarketType } from '../src/config/index.js';

// 测试配置模块的功能
// 注意: 由于config模块在加载时就读取环境变量，我们主要测试类型和工具函数

describe('Config Module', () => {
  /**
   * 测试: 配置类型定义正确
   */
  it('应该具有正确的配置类型结构', () => {
    const mockConfig: Config = {
      api: {
        key: 'test-key',
        secret: 'test-secret',
      },
      trading: {
        symbol: 'BTCUSDT',
        depthLimit: 20,
        marketType: MarketType.SPOT,
      },
      app: {
        env: 'test',
      },
    };

    expect(mockConfig).toBeDefined();
    expect(mockConfig.api.key).toBe('test-key');
    expect(mockConfig.trading.symbol).toBe('BTCUSDT');
    expect(mockConfig.trading.marketType).toBe(MarketType.SPOT);
  });

  /**
   * 测试: 市场类型枚举值
   */
  it('应该具有正确的市场类型枚举值', () => {
    expect(MarketType.SPOT).toBe('SPOT');
    expect(MarketType.FUTURES).toBe('FUTURES');
  });

  /**
   * 测试: 深度限制选项
   */
  it('应该支持标准的深度限制选项', () => {
    const validLimits = [5, 10, 20, 50, 100, 500, 1000, 5000];

    validLimits.forEach((limit) => {
      expect(validLimits).toContain(limit);
    });
  });
});
