/**
 * Binance Order Book Application Entry Point
 *
 * This is the main entry point for the order book application.
 * It demonstrates how to use the configuration and logger modules.
 */

import { BINANCE_CONFIG, TRADING_CONFIG, APP_CONFIG, validateConfig } from './config';
import { logger, createLogger } from './utils/logger';

// Create a dedicated logger for the main module
const mainLogger = createLogger({ prefix: '[Main]' });

/**
 * Application main function
 */
async function main(): Promise<void> {
  mainLogger.info('Starting Binance Order Book Application...');

  // Log current configuration (without sensitive data)
  mainLogger.info('Environment:', {
    nodeEnv: APP_CONFIG.NODE_ENV,
    isDev: APP_CONFIG.IS_DEV,
    defaultSymbol: TRADING_CONFIG.DEFAULT_SYMBOL,
    defaultDepth: TRADING_CONFIG.DEFAULT_DEPTH_LIMIT,
    hasApiKey: !!BINANCE_CONFIG.API_KEY,
  });

  // Validate configuration
  try {
    validateConfig();
    mainLogger.info('Configuration validated successfully');
  } catch (error) {
    mainLogger.warn(
      'Configuration validation warning:',
      error instanceof Error ? error.message : String(error)
    );
    mainLogger.info('Some features may be limited without valid API credentials');
  }

  mainLogger.info('Application initialized and ready');
  mainLogger.info('Waiting for order book service implementation...');
}

// Run the application
main().catch((error) => {
  logger.error('Application error:', error);
  process.exit(1);
});
