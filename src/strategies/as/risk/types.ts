/**
 * Position Manager Types
 */

export interface Trade {
  timestamp: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  symbol: string;
}

export interface PositionManagerConfig {
  symbol: string;
  maxPosition: number;
  minPosition: number;
  targetInventory: number;
}
