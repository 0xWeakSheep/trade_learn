/**
 * Ring Buffer (Circular Buffer) Utility
 *
 * Fixed-size buffer that overwrites old data when full.
 * Efficient for sliding window calculations.
 */

/**
 * Generic Ring Buffer implementation
 */
export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private readonly capacity: number;

  /**
   * Create a new ring buffer
   * @param capacity Maximum number of elements
   */
  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('Capacity must be positive');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Add an element to the buffer
   * Overwrites oldest element if buffer is full
   * @param item Element to add
   */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;

    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Buffer is full, move tail
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  /**
   * Remove and return the oldest element
   * @returns Oldest element, or undefined if empty
   */
  pop(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }

    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined;
    this.tail = (this.tail + 1) % this.capacity;
    this.count--;

    return item;
  }

  /**
   * Get the oldest element without removing it
   * @returns Oldest element, or undefined if empty
   */
  peek(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }
    return this.buffer[this.tail];
  }

  /**
   * Get the most recent element without removing it
   * @returns Newest element, or undefined if empty
   */
  peekBack(): T | undefined {
    if (this.count === 0) {
      return undefined;
    }
    const index = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[index];
  }

  /**
   * Get element at index (0 = oldest)
   * @param index Index from oldest (0) to newest (size-1)
   * @returns Element at index, or undefined
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) {
      return undefined;
    }
    const actualIndex = (this.tail + index) % this.capacity;
    return this.buffer[actualIndex];
  }

  /**
   * Get the most recent element by offset from the end
   * @param offset Offset from the most recent (0 = most recent)
   * @returns Element, or undefined if out of bounds
   */
  getRecent(offset: number = 0): T | undefined {
    if (offset < 0 || offset >= this.count) {
      return undefined;
    }
    const index = (this.head - 1 - offset + this.capacity) % this.capacity;
    return this.buffer[index];
  }

  /**
   * Get all elements as array (oldest first)
   * @returns Array of elements
   */
  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.tail + i) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Get all elements as array (newest first)
   * @returns Array of elements
   */
  toArrayReversed(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const index = (this.head - 1 - i + this.capacity) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Get current number of elements
   */
  size(): number {
    return this.count;
  }

  /**
   * Get maximum capacity
   */
  getCapacity(): number {
    return this.capacity;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    return this.count === this.capacity;
  }

  /**
   * Clear all elements
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /**
   * Iterate over elements (oldest first)
   */
  *[Symbol.iterator](): Iterator<T> {
    for (let i = 0; i < this.count; i++) {
      const index = (this.tail + i) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        yield item;
      }
    }
  }
}

/**
 * Numeric ring buffer with statistical methods
 */
export class NumericRingBuffer extends RingBuffer<number> {
  /**
   * Calculate sum of all elements
   */
  sum(): number {
    return this.toArray().reduce((acc, val) => acc + val, 0);
  }

  /**
   * Calculate mean (average)
   */
  mean(): number {
    if (this.isEmpty()) {
      return 0;
    }
    return this.sum() / this.size();
  }

  /**
   * Calculate variance
   * @param sample Use sample variance (n-1) instead of population (n)
   */
  variance(sample: boolean = true): number {
    if (this.size() < 2) {
      return 0;
    }

    const avg = this.mean();
    const squaredDiffs = this.toArray().map((val) => Math.pow(val - avg, 2));
    const sumSquaredDiffs = squaredDiffs.reduce((acc, val) => acc + val, 0);

    return sumSquaredDiffs / (this.size() - (sample ? 1 : 0));
  }

  /**
   * Calculate standard deviation
   * @param sample Use sample standard deviation
   */
  stdDev(sample: boolean = true): number {
    return Math.sqrt(this.variance(sample));
  }

  /**
   * Calculate min value
   */
  min(): number | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    return Math.min(...this.toArray());
  }

  /**
   * Calculate max value
   */
  max(): number | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    return Math.max(...this.toArray());
  }

  /**
   * Calculate range (max - min)
   */
  range(): number {
    const min = this.min();
    const max = this.max();
    if (min === undefined || max === undefined) {
      return 0;
    }
    return max - min;
  }

  /**
   * Calculate exponential moving average
   * @param decay Decay factor (0-1), higher = more weight on recent values
   */
  ema(decay: number = 0.94): number {
    const values = this.toArray();
    if (values.length === 0) {
      return 0;
    }

    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = decay * ema + (1 - decay) * values[i];
    }

    return ema;
  }
}
