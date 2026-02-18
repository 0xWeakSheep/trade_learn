/**
 * Avellaneda-Stoikov Model - Core Math
 *
 * Implementation of the AS market making formulas
 *
 * Reference: Avellaneda & Stoikov (2008)
 * "High-frequency trading in a limit order book"
 */
import { ASParameters, ASQuote, ASCalculationResult } from './types.js';

/**
 * Calculate reservation price
 *
 * The reservation price is the indifference price adjusted for inventory.
 * When inventory is positive (long), the reservation price is lower than
 * mid price to encourage selling.
 *
 * Formula: r = S - q * γ * σ²
 *
 * Where:
 *   r = reservation price
 *   S = mid price
 *   q = current inventory (positive for long, negative for short)
 *   γ = risk aversion parameter
 *   σ² = variance (sigma squared)
 *
 * @param midPrice Current mid price
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
  // r = S - q * γ * σ²
  const variance = sigma * sigma;
  const adjustment = inventory * gamma * variance;
  return midPrice - adjustment;
}

/**
 * Calculate optimal half spread
 *
 * The optimal distance from mid price to place orders.
 * Based on the trade-off between execution probability and profit margin.
 *
 * Formula: δ = (1/γ) * ln(1 + γ/κ) + 0.5 * γ * σ²
 *
 * Where:
 *   δ = optimal half spread
 *   γ = risk aversion parameter
 *   κ = order arrival intensity
 *   σ² = variance
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
  // Avoid division by zero
  if (kappa <= 0 || gamma <= 0) {
    throw new Error('Kappa and gamma must be positive');
  }

  // δ = (1/γ) * ln(1 + γ/κ) + 0.5 * γ * σ²
  const term1 = (1 / gamma) * Math.log(1 + gamma / kappa);
  const term2 = 0.5 * gamma * sigma * sigma;

  return term1 + term2;
}

/**
 * Calculate bid and ask prices
 *
 * @param reservationPrice Reservation price (r)
 * @param halfSpread Optimal half spread (δ)
 * @returns Bid and ask prices
 */
export function calculateBidAskPrices(
  reservationPrice: number,
  halfSpread: number
): { bidPrice: number; askPrice: number } {
  // Bid = r - δ
  // Ask = r + δ
  const bidPrice = reservationPrice - halfSpread;
  const askPrice = reservationPrice + halfSpread;

  return { bidPrice, askPrice };
}

/**
 * Calculate complete AS quote
 *
 * Combines all formulas to produce the final quote prices
 *
 * @param midPrice Current mid price
 * @param inventory Current inventory
 * @param params AS parameters (gamma, kappa, sigma)
 * @returns ASQuote with all calculated values
 */
export function calculateASQuote(
  midPrice: number,
  inventory: number,
  params: ASParameters
): ASQuote {
  const { gamma, kappa, sigma } = params;

  // Calculate reservation price
  const reservationPrice = calculateReservationPrice(midPrice, inventory, gamma, sigma);

  // Calculate half spread
  const halfSpread = calculateHalfSpread(gamma, kappa, sigma);

  // Calculate bid/ask prices
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
 * Calculate AS with time-to-horizon adjustment
 *
 * As the trading session approaches its end (T -> 0),
 * the reservation price converges to the mid price.
 *
 * Formula: r(t) = S - q * γ * σ² * (T - t)
 *
 * @param midPrice Current mid price
 * @param inventory Current inventory
 * @param params AS parameters
 * @param timeRemaining Time remaining until session end (as fraction of total)
 * @returns Adjusted quote
 */
export function calculateASQuoteWithTime(
  midPrice: number,
  inventory: number,
  params: ASParameters,
  timeRemaining: number
): ASQuote {
  const { gamma, kappa, sigma } = params;

  // Clamp time remaining to [0, 1]
  const t = Math.max(0, Math.min(1, timeRemaining));

  // Time-adjusted reservation price
  // As t -> 0, the adjustment term -> 0
  const variance = sigma * sigma;
  const timeFactor = t; // Linear decay for simplicity
  const adjustment = inventory * gamma * variance * timeFactor;
  const reservationPrice = midPrice - adjustment;

  // Half spread may also adjust with time
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
 * Apply price constraints to AS quote
 *
 * Ensures prices are within valid bounds:
 * - Bid price doesn't exceed mid price
 * - Ask price isn't below mid price
 * - Minimum spread is maintained
 *
 * @param quote Original AS quote
 * @param minSpread Minimum spread requirement
 * @param maxSpreadMultiplier Maximum spread as multiple of half-spread
 * @returns Constrained quote
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

  return {
    ...quote,
    bidPrice,
    askPrice,
    halfSpread,
  };
}

/**
 * Round prices to tick size
 *
 * @param price Raw price
 * @param tickSize Minimum price increment
 * @param direction 'down' for bid (floor), 'up' for ask (ceiling)
 * @returns Rounded price
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
 *
 * @param midPrice Current mid price
 * @param inventory Current inventory
 * @param params AS parameters
 * @param tickSize Price tick size
 * @param minSpread Minimum spread
 * @param maxSpreadMultiplier Maximum spread multiplier
 * @returns Final calculation result with rounded prices
 */
export function calculateAS(
  midPrice: number,
  inventory: number,
  params: ASParameters,
  tickSize: number,
  minSpread: number,
  maxSpreadMultiplier: number
): ASCalculationResult {
  // Calculate base AS quote
  const quote = calculateASQuote(midPrice, inventory, params);

  // Apply constraints
  const constrainedQuote = applyPriceConstraints(quote, minSpread, maxSpreadMultiplier);

  // Round prices to tick size
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

/**
 * Calculate inventory skew factor
 *
 * Returns a value between -1 and 1 indicating how far
 * inventory is from target (normalized by position limits)
 *
 * @param inventory Current inventory
 * @param targetInventory Target inventory level
 * @param maxPosition Maximum position (positive)
 * @returns Skew factor (-1 to 1)
 */
export function calculateInventorySkew(
  inventory: number,
  targetInventory: number,
  maxPosition: number
): number {
  const deviation = inventory - targetInventory;
  return Math.max(-1, Math.min(1, deviation / maxPosition));
}

/**
 * Calculate expected profit per trade
 *
 * Based on the half spread and probability of fill
 *
 * @param halfSpread Optimal half spread
 * @param fillProbability Probability of order being filled (0-1)
 * @returns Expected profit
 */
export function calculateExpectedProfit(
  halfSpread: number,
  fillProbability: number
): number {
  return halfSpread * fillProbability;
}
