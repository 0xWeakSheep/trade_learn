/**
 * Avellaneda-Stoikov Model - Core Math Formulas
 *
 * Implementation of the AS market making formulas
 *
 * Reference: Avellaneda & Stoikov (2008)
 * "High-frequency trading in a limit order book"
 */
import { ASParameters, ASQuote, ASCalculationResult } from '../config/types.js';

/**
 * Calculate reservation price
 *
 * Formula: r = S - q * γ * σ²
 *
 * @param midPrice Current mid price (S)
 * @param inventory Current inventory position (q)
 * @param gamma Risk aversion parameter (γ)
 * @param sigma Volatility (σ)
 * @returns Reservation price
 */
export function calculateReservationPrice(
  midPrice: number,
  inventory: number,
  gamma: number,
  sigma: number
): number {
  const variance = sigma * sigma;
  const adjustment = inventory * gamma * variance;
  return midPrice - adjustment;
}

/**
 * Calculate optimal half spread
 *
 * Formula: δ = (1/γ) * ln(1 + γ/κ) + 0.5 * γ * σ²
 *
 * @param gamma Risk aversion parameter (γ)
 * @param kappa Order arrival intensity (κ)
 * @param sigma Volatility (σ)
 * @returns Optimal half spread
 */
export function calculateHalfSpread(
  gamma: number,
  kappa: number,
  sigma: number
): number {
  if (kappa <= 0 || gamma <= 0) {
    throw new Error('Kappa and gamma must be positive');
  }

  const term1 = (1 / gamma) * Math.log(1 + gamma / kappa);
  const term2 = 0.5 * gamma * sigma * sigma;

  return term1 + term2;
}

/**
 * Calculate bid and ask prices from reservation price and half spread
 */
export function calculateBidAskPrices(
  reservationPrice: number,
  halfSpread: number
): { bidPrice: number; askPrice: number } {
  return {
    bidPrice: reservationPrice - halfSpread,
    askPrice: reservationPrice + halfSpread,
  };
}

/**
 * Calculate complete AS quote
 */
export function calculateASQuote(
  midPrice: number,
  inventory: number,
  params: ASParameters
): ASQuote {
  const { gamma, kappa, sigma } = params;

  const reservationPrice = calculateReservationPrice(midPrice, inventory, gamma, sigma);
  const halfSpread = calculateHalfSpread(gamma, kappa, sigma);
  const { bidPrice, askPrice } = calculateBidAskPrices(reservationPrice, halfSpread);

  return {
    midPrice,
    reservationPrice,
    halfSpread,
    bidPrice,
    askPrice,
    inventory,
    gamma,
    kappa,
    sigma,
    timestamp: Date.now(),
  };
}

/**
 * Apply price constraints (min/max spread)
 */
export function applyPriceConstraints(
  quote: ASQuote,
  minSpread: number,
  maxSpreadMultiplier: number
): ASQuote {
  let { bidPrice, askPrice, halfSpread } = quote;

  // Ensure bid < mid < ask
  if (bidPrice >= quote.midPrice) {
    bidPrice = quote.midPrice - halfSpread;
  }
  if (askPrice <= quote.midPrice) {
    askPrice = quote.midPrice + halfSpread;
  }

  // Apply minimum spread
  const currentSpread = askPrice - bidPrice;
  if (currentSpread < minSpread) {
    const adjustment = (minSpread - currentSpread) / 2;
    bidPrice -= adjustment;
    askPrice += adjustment;
    halfSpread = (askPrice - bidPrice) / 2;
  }

  // Apply maximum spread
  const maxSpread = quote.halfSpread * maxSpreadMultiplier * 2;
  if (currentSpread > maxSpread) {
    const adjustment = (currentSpread - maxSpread) / 2;
    bidPrice += adjustment;
    askPrice -= adjustment;
    halfSpread = maxSpread / 2;
  }

  return { ...quote, bidPrice, askPrice, halfSpread };
}

/**
 * Round prices to tick size
 */
export function roundToTickSize(
  price: number,
  tickSize: number,
  direction: 'down' | 'up' | 'nearest' = 'nearest'
): number {
  const normalized = price / tickSize;

  let rounded: number;
  switch (direction) {
    case 'down':
      rounded = Math.floor(normalized);
      break;
    case 'up':
      rounded = Math.ceil(normalized);
      break;
    case 'nearest':
    default:
      rounded = Math.round(normalized);
  }

  return rounded * tickSize;
}

/**
 * Complete AS calculation with all constraints
 */
export function calculateAS(
  midPrice: number,
  inventory: number,
  params: ASParameters,
  tickSize: number,
  minSpread: number,
  maxSpreadMultiplier: number
): ASCalculationResult {
  const quote = calculateASQuote(midPrice, inventory, params);
  const constrainedQuote = applyPriceConstraints(quote, minSpread, maxSpreadMultiplier);

  const bidPrice = roundToTickSize(constrainedQuote.bidPrice, tickSize, 'down');
  const askPrice = roundToTickSize(constrainedQuote.askPrice, tickSize, 'up');

  return {
    reservationPrice: constrainedQuote.reservationPrice,
    halfSpread: constrainedQuote.halfSpread,
    bidPrice,
    askPrice,
    parameters: params,
  };
}
