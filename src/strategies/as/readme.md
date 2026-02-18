# Avellaneda-Stoikov 做市策略设计文档

## 1. 策略简介

Avellaneda-Stoikov (AS) 模型是一个高频做市策略，通过数学优化确定最优报价价格。核心思想是：

- **保留价格 (Reservation Price)**: 根据当前库存调整的中性价格
- **最优价差 (Optimal Spread)**: 平衡成交概率和利润的买卖价差

### 核心公式

```
保留价格: r = S - q * γ * σ²
最优半价差: δ = (1/γ) * ln(1 + γ/κ) + 0.5 * γ * σ²

其中:
- S: 中间价 (Mid Price)
- q: 当前库存 (正=多头, 负=空头)
- γ: 风险厌恶系数
- σ: 价格波动率
- κ: 订单到达强度
```

## 2. 文件结构

```
src/strategies/as/
├── index.ts          # 策略主类 - AvellanedaStoikovStrategy
├── core.ts           # AS数学公式实现
├── calculator.ts     # 参数计算器 (σ, κ)
├── position.ts       # 持仓管理器
├── config.ts         # 配置定义和预设
├── types.ts          # TypeScript类型定义
└── readme.md         # 本设计文档
```

## 3. 各文件职责与代码查找指南

### 3.1 index.ts - 策略主入口

**职责**: 策略的生命周期管理、主循环、订单管理

**关键代码位置**:
- `class AvellanedaStoikovStrategy` - 策略主类定义 (line ~50)
- `onInitialize()` - 初始化，加载历史数据 (line ~65)
- `update()` - 主循环，每次tick执行 (line ~200)
- `manageOrders()` - 订单管理逻辑 (line ~350)
- `calculateASQuote()` - 计算AS报价 (通过调用core.ts)

**如何阅读**: 从这个文件开始，了解策略的整体流程

---

### 3.2 core.ts - AS数学核心

**职责**: 实现AS模型的数学公式

**关键函数**:
```typescript
// 计算保留价格 (line ~25)
calculateReservationPrice(midPrice, inventory, gamma, sigma)
// 公式: r = S - q * γ * σ²

// 计算最优半价差 (line ~50)
calculateHalfSpread(gamma, kappa, sigma)
// 公式: δ = (1/γ) * ln(1 + γ/κ) + 0.5 * γ * σ²

// 计算完整AS报价 (line ~90)
calculateASQuote(midPrice, inventory, params)
// 返回: { midPrice, reservationPrice, halfSpread, bidPrice, askPrice }

// 价格约束和取整 (line ~180)
calculateAS(midPrice, inventory, params, tickSize, minSpread, maxSpreadMultiplier)
// 应用最小价差、最大价差限制，并按tickSize取整
```

**如何阅读**: 理解AS模型的数学原理时查看此文件

---

### 3.3 calculator.ts - 参数计算器

**职责**: 实时计算 σ (波动率) 和 κ (订单到达强度)

**关键类**:

```typescript
// 波动率计算器 (line ~15)
class VolatilityCalculator {
  addPrice(price)      // 添加价格点
  addCandles(candles)  // 添加K线数据
  calculate()          // 计算标准差
}

// Kappa计算器 (line ~95)
class KappaCalculator {
  addOrderBook(orderBook)  // 添加订单簿数据
  calculate(spreadMultiplier)  // 基于spread计算κ
}

// 组合估计器 (line ~175)
class ParameterEstimator {
  processCandles(candles)      // 处理K线
  processOrderBook(orderBook)  // 处理订单簿
  getEstimates()               // 获取 σ 和 κ
}
```

**如何阅读**: 了解市场参数如何动态计算时查看此文件

---

### 3.4 position.ts - 持仓管理

**职责**: 跟踪库存、计算PnL、执行仓位限制

**关键属性和方法**:
```typescript
class PositionManager {
  // 状态属性
  currentInventory      // 当前库存 (line ~45)
  unrealizedPnl        // 未实现盈亏
  realizedPnl          // 已实现盈亏

  // 核心方法
  initialize()         // 从交易所初始化持仓 (line ~95)
  updateFromOrder(order)  // 根据成交更新持仓 (line ~115)
  updateUnrealizedPnl(midPrice)  // 更新浮动盈亏 (line ~185)

  // 风控检查
  canBuy(quantity)     // 检查是否可以买入 (line ~200)
  canSell(quantity)    // 检查是否可以卖出
  isMaxLong / isMaxShort  // 是否触及仓位限制
}
```

**如何阅读**: 了解库存管理和风控逻辑时查看此文件

---

### 3.5 config.ts - 配置管理

**职责**: 定义配置结构、提供预设配置、配置验证

**关键内容**:
```typescript
// 默认配置 (line ~10)
DEFAULT_AS_CONFIG

// 预设配置 (line ~70)
AS_PRESETS = {
  conservative: { gamma: 1.0, ... },   // 保守: 宽价差，强库存控制
  moderate: { gamma: 0.5, ... },       // 稳健: 平衡
  aggressive: { gamma: 0.1, ... }      // 激进: 窄价差，弱库存控制
}

// 创建配置 (line ~55)
createASConfig(partialConfig)

// 验证配置 (line ~95)
validateASConfig(config)
```

**如何阅读**: 了解如何配置策略参数时查看此文件

---

### 3.6 types.ts - 类型定义

**职责**: 定义所有接口和类型

**关键类型**:
```typescript
ASConfig          // 策略配置
ASParameters      // AS参数 (gamma, kappa, sigma)
ASQuote           // AS报价结果
ASState           // 策略状态
```

**如何阅读**: 查看数据结构的定义

## 4. 参数配置指南

### 4.1 配置方式

#### 方式1: 使用预设配置
```typescript
import { createASConfig, AS_PRESETS } from './strategies/as/config.js';

// 使用稳健预设
const config = createASConfig({
  symbol: 'BTCUSDT',
  ...AS_PRESETS.moderate,
  orderSize: 0.001,
  maxPosition: 0.01
});
```

#### 方式2: 自定义配置
```typescript
const config = createASConfig({
  symbol: 'BTCUSDT',
  baseAsset: 'BTC',
  quoteAsset: 'USDT',

  // AS模型参数
  gamma: 0.5,           // 风险厌恶系数 (0.1-1.0)
  kappa: 0.01,          // 订单到达强度 (可选，自动计算)
  sigma: 0.001,         // 波动率 (可选，自动计算)

  // 订单管理
  orderSize: 0.001,     // 订单大小
  maxSpreadMultiplier: 3.0,  // 最大价差倍数
  minSpread: 0.01,      // 最小价差

  // 持仓管理
  maxPosition: 0.01,    // 最大多头仓位
  minPosition: -0.01,   // 最大空头仓位
  targetInventory: 0,   // 目标库存 (通常设为0)

  // 执行参数
  updateIntervalMs: 1000,  // 更新间隔(毫秒)
  volatilityWindow: 100,   // 波动率计算窗口
  kappaWindow: 50,         // kappa计算窗口

  // 安全
  dryRun: true,         // 模拟模式
  stopLossThreshold: -1000  // 止损阈值
});
```

### 4.2 参数详解

#### Gamma (γ) - 风险厌恶系数
| 取值范围 | 效果 |
|---------|------|
| 0.1-0.3 (激进) | 价差窄，库存控制弱，成交率高 |
| 0.4-0.6 (稳健) | 平衡，推荐默认值 0.5 |
| 0.7-1.0 (保守) | 价差宽，库存控制强，成交率低 |

**如何选择**: 高流动性市场用激进，波动大/流动性差用保守

#### Kappa (κ) - 订单到达强度
- **含义**: 市场价格对订单流的敏感度
- **自动计算**: 基于订单簿spread自动估算
- **手动设置**: 如果不确定，建议让系统自动计算

#### Sigma (σ) - 波动率
- **含义**: 资产价格的波动程度
- **自动计算**: 基于历史K线数据计算
- **手动设置**: 仅在特定市场条件下手动指定

#### 仓位限制
```typescript
maxPosition: 0.01   // 最多持有多头 0.01 BTC
minPosition: -0.01  // 最多持有空头 0.01 BTC
```

当触及限制时，策略会:
1. 停止在该方向下单
2. 仅在对侧挂单以降低库存

### 4.3 预设配置对比

| 参数 | 保守 (conservative) | 稳健 (moderate) | 激进 (aggressive) |
|-----|-------------------|----------------|------------------|
| gamma | 1.0 | 0.5 | 0.1 |
| maxSpreadMultiplier | 4.0 | 3.0 | 2.0 |
| minSpread | 0.02 | 0.01 | 0.005 |
| updateIntervalMs | 2000 | 1000 | 500 |
| 适用场景 | 低流动性/高波动 | 正常市场 | 高流动性/低波动 |

### 4.4 命令行配置

```bash
# 使用预设
pnpm dev -p conservative

# 自定义gamma
pnpm dev -g 0.3

# 自定义订单大小和仓位限制
pnpm dev -o 0.01 -m 0.1

# 自定义更新频率
pnpm dev -i 500
```

## 5. 阅读代码建议路径

### 快速理解策略
1. **先看** `core.ts` - 理解AS数学公式
2. **再看** `index.ts` 中的 `update()` 方法 - 理解主循环逻辑
3. **最后** `position.ts` - 理解库存管理

### 深入理解参数计算
1. `calculator.ts` - 理解 σ 和 κ 如何计算
2. `config.ts` - 理解配置选项

### 添加新功能
- 修改风控逻辑 → `position.ts`
- 修改报价逻辑 → `core.ts` 或 `index.ts`
- 添加新参数 → `types.ts` + `config.ts`

## 6. 调试和监控

策略运行时，控制台会输出以下信息:

```
Mid Price:           67909.01        // 中间价
Reservation Price:   67909.01        // 保留价格 (库存为0时等于中间价)
Half Spread:         1.3863          // 最优半价差
Bid:                 67907.61        // 买单价格
Ask:                 67910.40        // 卖单价格
Spread:              2.79            // 价差
Inventory:           0.000000        // 当前库存
Gamma:               0.5000          // 当前使用的gamma
Kappa:               0.500000        // 当前使用的kappa
Sigma:               0.000385        // 当前使用的sigma
```

**关键观察点**:
- 库存不为0时，保留价格会向相反方向偏移
- Kappa值越大，价差越小
- 波动率越大，价差越大
