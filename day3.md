这是为你准备的 **Day 3 学习笔记总结**。

你可以直接复制粘贴到你的 Notion/Obsidian/Markdown 笔记本中。这份笔记剥离了复杂的微分方程推导，只保留了**实战中最关键的定义、公式和参数计算方法**，完全遵循第一性原理。

---

# 📅 Day 3: Avellaneda-Stoikov (AS) 做市模型

## 1. 核心逻辑（第一性原理）
AS 模型本质上是在回答两个问题：
1.  **位置（Positioning）**：考虑到我手里的库存风险，我的报价中心应该偏离市场价多少？
2.  **宽度（Width）**：考虑到市场波动和流动性，我的买卖单应该张开多大？

**一句话总结**：
> **AS模型 = 贪婪（赚取Spread）与 恐惧（库存风险 & 市场波动）的数学平衡。**

---

## 2. 核心公式（实战版）

### A. 保留价格 (Reservation Price, $r$)
这是你内心的“真实价格”，由库存决定。
$$ r = s - q \cdot \gamma \cdot \sigma^2 $$

*   $s$: 当前市场中间价 (Mid Price)。
*   $q$: 当前库存数量（Inventory）。
    *   $q > 0$: 持有多头，想卖，$r$ 下移。
    *   $q < 0$: 持有空头，想买，$r$ 上移。
*   $\gamma$: 风险厌恶系数 (Risk Aversion)。
*   $\sigma^2$: 市场价格方差 (Volatility Squared)。

### B. 最优半价差 (Optimal Half-Spread, $\delta$)
这是你的报价离 $r$ 的距离。
$$ \delta = \frac{1}{\gamma} \ln(1 + \frac{\gamma}{\kappa}) + \frac{1}{2}\gamma\sigma^2 $$

*   $\kappa$ (Kappa): 订单流密度参数（衡量市场流动性对价格的敏感度）。
*   **注**：最终报价为 $Ask = r + \delta$, $Bid = r - \delta$。

---

## 3. 关键参数详解与计算（重点！）

这是从理论到代码落地的最大难点。

### 参数一：波动率 $\sigma$ (Volatility)
**定义**：价格变化的剧烈程度。做市商通常关注**高频波动率**（如1分钟或秒级）。

#### 计算方法 1：滚动标准差 (Rolling Standard Deviation)
最简单，适合Day 3入门。
$$ \sigma = \text{StdDev}(\Delta P_{t...t-n}) $$

**Python实现逻辑**：
```python
# 假设 prices 是一个包含最近N个mid_price的列表
# 1. 计算对数收益率
returns = np.diff(np.log(prices))
# 2. 计算标准差 (通常不需要年化，只需保持时间单位一致，如"每秒波动率")
sigma = np.std(returns)
```

#### 计算方法 2：EWMA (指数加权移动平均)
更灵敏，给近期数据更高权重（进阶推荐）。
$$ \sigma_t^2 = \alpha \cdot r_t^2 + (1-\alpha) \cdot \sigma_{t-1}^2 $$

---

### 参数二：流动性参数 $\kappa$ (Kappa)
**定义**：衡量“报价稍微远离中间价，成交概率下降得有多快”。
*   $\kappa$ 大：市场缺乏深度，价格稍微远一点就没人理你（成交率暴跌）。
*   $\kappa$ 小：市场深度极好，挂远一点也能成交。

**物理公式**：
订单到达率（成交概率） $\lambda(\delta) = A \cdot e^{-\kappa \cdot \delta}$

#### 计算方法 1：经验法则 (Heuristic) - Day 3 推荐
如果不做复杂回归，可以用平均Spread来估算。
$$ \kappa \approx \frac{1}{\text{Average Market Spread}} $$
*   *逻辑*：如果市场平均Spread是1元，意味着大家都认为偏离0.5元是合理的。

#### 计算方法 2：历史回归 (Regression) - 进阶
收集历史成交数据（Trade Tape），统计在不同距离 $\delta$ 下的成交密度。
1.  对公式取对数：$\ln(\lambda) = \ln(A) - \kappa \cdot \delta$
2.  这是一条直线方程 $y = b - ax$。
3.  **操作**：
    *   X轴：你的挂单距离 ($\delta$)。
    *   Y轴：在该距离下的单位时间成交量取对数 ($\ln(\text{Fill Rate})$)。
    *   做线性回归，斜率的绝对值就是 $\kappa$。

---

### 参数三：风险厌恶系数 $\gamma$ (Gamma)
**定义**：你有多怕库存积压？这不是算出来的，是**调出来的**。

*   **取值范围**：通常在 $0.01$ 到 $5.0$ 之间。
*   **调试方法**：
    *   如果发现库存经常积压到上限（比如满仓卖不掉） $\rightarrow$ **调大 $\gamma$**（让 $r$ 移动得更剧烈，加速甩货）。
    *   如果发现Spread太宽，总是成不了交，且库存一直在0附近不动 $\rightarrow$ **调小 $\gamma$**。

---

## 4. 策略逻辑流 (Pseudocode)

将上述内容整合到你的策略循环中：

```python
while True:
    # 1. 获取市场快照
    mid_price = get_mid_price()
    
    # 2. 更新状态
    inventory = get_current_position() # 当前持仓 q
    
    # 3. 计算市场参数 (基于过去N个tick)
    sigma = calculate_volatility(history_prices)
    kappa = calculate_kappa(history_trades) # 或使用固定经验值
    
    # 4. 计算AS核心指标
    # A. 算出"心理价位" (恐惧因子)
    reservation_price = mid_price - (inventory * gamma * (sigma**2))
    
    # B. 算出"半宽" (贪婪因子)
    half_spread = (1/gamma) * np.log(1 + gamma/kappa) + 0.5 * gamma * (sigma**2)
    
    # 5. 生成最终挂单
    my_bid = reservation_price - half_spread
    my_ask = reservation_price + half_spread
    
    # 6. 发送订单
    place_limit_orders(my_bid, my_ask)
    
    sleep(1) # 等待下一个tick
```

## 5. Day 3 避坑指南
1.  **量纲统一**：计算 $\sigma$ 和 $\kappa$ 时，时间单位要一致（比如都按“秒”或“Tick”）。
2.  **Spread 保护**：AS公式计算出的 Spread 有时会非常小（甚至小于交易所的 Tick Size）。
    *   *修正*：`final_spread = max(calculated_spread, min_tick_size * 2)`。
3.  **单边市风险**：AS模型假设价格是均值回归或随机游走的。如果价格单边暴涨，持有空头的 $r$ 虽然会上移，但可能追不上市场涨幅，导致亏损。这是AS模型的天然缺陷（Day 4 的 OFI 信号就是为了解决这个）。