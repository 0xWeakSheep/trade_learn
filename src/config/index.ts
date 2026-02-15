import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Trading pair configuration
 */
export const TRADING_CONFIG = {
  /** Default trading symbol */
  DEFAULT_SYMBOL: process.env.DEFAULT_SYMBOL || 'BTCUSDT',
  /** Default order book depth limit */
  DEFAULT_DEPTH_LIMIT: parseInt(process.env.DEFAULT_DEPTH_LIMIT || '20', 10),
  /** Supported depth limits by Binance API */
  SUPPORTED_DEPTH_LIMITS: [5, 10, 20, 50, 100, 500, 1000, 5000] as const,
} as const;

/**
 * Binance API configuration
 */
export const BINANCE_CONFIG = {
  /** Binance API Key - loaded from environment */
  API_KEY: process.env.BINANCE_API_KEY || '',
  /** Binance Secret Key - loaded from environment */
  SECRET_KEY: process.env.BINANCE_SECRET_KEY || '',
  /** Base URL for Binance Spot API */
  BASE_URL: 'https://api.binance.com',
  /** WebSocket base URL for Binance Stream */
  WS_BASE_URL: 'wss://stream.binance.com:9443/ws',
  /** Request timeout in milliseconds */
  TIMEOUT: 30000,
} as const;

/**
 * Application environment configuration
 */
export const APP_CONFIG = {
  /** Current environment */
  NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  /** Whether running in development mode */
  IS_DEV: process.env.NODE_ENV !== 'production',
  /** Whether running in production mode */
  IS_PROD: process.env.NODE_ENV === 'production',
} as const;

/**
 * Validates that all required configuration is present
 * @throws Error if required configuration is missing
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!BINANCE_CONFIG.API_KEY) {
    errors.push('BINANCE_API_KEY is required. Please set it in your .env file.');
  }

  if (!BINANCE_CONFIG.SECRET_KEY) {
    errors.push('BINANCE_SECRET_KEY is required. Please set it in your .env file.');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Type guard to check if a depth limit is supported
 */
export function isValidDepthLimit(limit: number): boolean {
  return TRADING_CONFIG.SUPPORTED_DEPTH_LIMITS.includes(limit as typeof TRADING_CONFIG.SUPPORTED_DEPTH_LIMITS[number]);
}

// Re-export all configurations for convenience
export { BINANCE_CONFIG, TRADING_CONFIG, APP_CONFIG };
