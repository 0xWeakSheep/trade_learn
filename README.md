# trade_learn

币安订单簿实时监控工具 - 基于TypeScript和官方SDK开发

## 功能特性

- 📊 **实时订单簿** - 每秒刷新币安现货/合约订单簿数据
- 🎨 **彩色显示** - 卖盘(红色)/买盘(绿色)/价差(黄色)区分
- 📈 **累计数量** - 显示每档累计挂单量
- ⚡ **支持多档深度** - 5/10/20/50/100/500/1000/5000档可选
- 🔄 **市场切换** - 支持现货(SPOT)和合约(FUTURES)市场
- 🔧 **命令行参数** - 灵活配置交易对、深度、市场类型

## 使用方法

```bash
# 安装依赖
npm install

# 默认: BTCUSDT 现货 20档
pnpm dev

# 查看ETH/USDT 现货 10档
pnpm dev --symbol ETHUSDT --limit 10

# 查看BTC合约 50档
pnpm dev -s BTCUSDT -f -l 50
```

## 命令行选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-s, --symbol` | 交易对 | BTCUSDT |
| `-l, --limit` | 显示深度数量 | 20 |
| `-f, --futures` | 使用合约市场 | false |
| `--spot` | 使用现货市场 | true |
| `-h, --help` | 显示帮助 | - |

## 项目结构

```
src/
├── config/           # 配置管理
├── services/         # 币安API服务
├── utils/            # 工具函数
├── main.ts           # 入口文件
tests/                # 单元测试
```

## 测试

```bash
pnpm test:run
```

## 技术栈

- TypeScript 5.7+
- @binance/connector-typescript (官方SDK)
- Vitest (测试框架)
- tsx (TypeScript执行器)
