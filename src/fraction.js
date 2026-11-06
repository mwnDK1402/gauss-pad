/**
 * Exact rational arithmetic backed by BigInt.
 *
 * Invariants maintained by construction:
 *   - denominator is never zero
 *   - denominator is always positive
 *   - numerator and denominator are reduced to lowest terms
 *   - zero is represented as 0/1
 *
 * This module deliberately performs no floating-point arithmetic.
 */

function gcd(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

function toBigInt(value, label) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${label} must be a safe integer or a BigInt.`);
    }
    return BigInt(value);
  }
  throw new TypeError(`${label} must be a safe integer or a BigInt.`);
}

export class Fraction {
  /**
   * @param {bigint|number} numerator
   * @param {bigint|number} denominator
   */
  constructor(numerator, denominator = 1n) {
    let n = toBigInt(numerator, "Numerator");
    let d = toBigInt(denominator, "Denominator");

    if (d === 0n) {
      throw new RangeError("Denominator must not be zero.");
    }

    if (d < 0n) {
      n = -n;
      d = -d;
    }

    const divisor = gcd(n, d);
    n /= divisor;
    d /= divisor;

    if (n === 0n) d = 1n;

    this.numerator = n;
    this.denominator = d;
    Object.freeze(this);
  }

  add(other) {
    return new Fraction(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  sub(other) {
    return new Fraction(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  mul(other) {
    return new Fraction(
      this.numerator * other.numerator,
      this.denominator * other.denominator,
    );
  }

  div(other) {
    if (other.isZero()) {
      throw new RangeError("Cannot divide by zero.");
    }
    return new Fraction(
      this.numerator * other.denominator,
      this.denominator * other.numerator,
    );
  }

  neg() {
    return new Fraction(-this.numerator, this.denominator);
  }

  equals(other) {
    return (
      this.numerator === other.numerator &&
      this.denominator === other.denominator
    );
  }

  isZero() {
    return this.numerator === 0n;
  }

  isOne() {
    return this.numerator === 1n && this.denominator === 1n;
  }

  isNegative() {
    return this.numerator < 0n;
  }

  toString() {
    return this.denominator === 1n
      ? this.numerator.toString()
      : `${this.numerator.toString()}/${this.denominator.toString()}`;
  }

  /**
   * Parse an exact integer or fraction such as "3", "-2", "1/2", "-3/4".
   * Surrounding whitespace is ignored; whitespace inside the value is not.
   * Decimals, empty values, and malformed fractions are rejected.
   *
   * @param {string} value
   * @returns {Fraction}
   */
  static parse(value) {
    if (typeof value !== "string") {
      throw new TypeError("Fraction input must be a string.");
    }

    const text = value.trim();
    if (text === "") {
      throw new TypeError("Fraction input must not be empty.");
    }

    const integerPattern = /^[+-]?\d+$/;
    const fractionPattern = /^([+-]?\d+)\/([+-]?\d+)$/;

    if (integerPattern.test(text)) {
      return new Fraction(BigInt(text), 1n);
    }

    const match = fractionPattern.exec(text);
    if (match) {
      return new Fraction(BigInt(match[1]), BigInt(match[2]));
    }

    throw new TypeError(`Invalid fraction: "${value}".`);
  }
}

export const ZERO = new Fraction(0n, 1n);
export const ONE = new Fraction(1n, 1n);
