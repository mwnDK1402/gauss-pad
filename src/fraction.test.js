import test from "node:test";
import assert from "node:assert/strict";

import { Fraction, ZERO, ONE } from "./fraction.js";

const f = (n, d = 1n) => new Fraction(n, d);

test("construction reduces to lowest terms", () => {
  assert.equal(f(6n, 8n).toString(), "3/4");
  assert.equal(f(10n, 5n).toString(), "2");
  assert.equal(f(-14n, 21n).toString(), "-2/3");
  assert.equal(f(0n, 7n).toString(), "0");
});

test("negative denominators are normalized", () => {
  const value = f(3n, -4n);
  assert.equal(value.numerator, -3n);
  assert.equal(value.denominator, 4n);
  assert.equal(value.toString(), "-3/4");

  assert.equal(f(-3n, -4n).toString(), "3/4");
  assert.equal(f(0n, -5n).toString(), "0");
});

test("construction rejects a zero denominator", () => {
  assert.throws(() => f(1n, 0n), /Denominator must not be zero/);
  assert.throws(() => f(0n, 0n), /Denominator must not be zero/);
});

test("zero handling", () => {
  assert.equal(ZERO.toString(), "0");
  assert.ok(ZERO.isZero());
  assert.equal(ZERO.isOne(), false);
  assert.equal(ZERO.isNegative(), false);
  assert.equal(ZERO.equals(f(0n, 9n)), true);
});

test("one handling", () => {
  assert.equal(ONE.toString(), "1");
  assert.ok(ONE.isOne());
  assert.equal(ONE.isZero(), false);
  assert.equal(ONE.equals(f(5n, 5n)), true);
});

test("sign predicates", () => {
  assert.equal(f(-1n, 2n).isNegative(), true);
  assert.equal(f(1n, -2n).isNegative(), true);
  assert.equal(f(1n, 2n).isNegative(), false);
  assert.equal(ZERO.isNegative(), false);
});

test("addition and subtraction are exact", () => {
  assert.equal(f(1n, 2n).add(f(1n, 3n)).toString(), "5/6");
  assert.equal(f(1n, 2n).add(f(-1n, 2n)).toString(), "0");
  assert.equal(f(3n, 4n).sub(f(1n, 4n)).toString(), "1/2");
  assert.equal(f(7n).sub(f(10n)).toString(), "-3");
});

test("multiplication and negation are exact", () => {
  assert.equal(f(2n, 3n).mul(f(9n, 4n)).toString(), "3/2");
  assert.equal(f(-2n, 3n).mul(f(3n, -4n)).toString(), "1/2");
  assert.equal(f(3n, 5n).neg().toString(), "-3/5");
  assert.equal(f(-3n, 5n).neg().toString(), "3/5");
  assert.equal(ZERO.neg().toString(), "0");
});

test("division is exact and rejects division by zero", () => {
  assert.equal(f(1n, 2n).div(f(3n, 4n)).toString(), "2/3");
  assert.equal(f(-1n, 2n).div(f(3n, -4n)).toString(), "2/3");
  assert.equal(f(5n).div(f(2n)).toString(), "5/2");
  assert.throws(() => f(1n, 2n).div(ZERO), /Cannot divide by zero/);
});

test("equality compares exact reduced values", () => {
  assert.ok(f(2n, 3n).equals(f(10n, 15n)));
  assert.ok(!f(2n, 3n).equals(f(2n, 5n)));
  assert.ok(f(-2n, -3n).equals(f(2n, 3n)));
});

test("large values stay exact with BigInt", () => {
  const big = new Fraction(9007199254740991n, 3n);
  assert.equal(big.add(f(1n, 3n)).toString(), "9007199254740992/3");
  assert.equal(
    f(123456789012345678901234567890n, 3n).toString(),
    "41152263004115226300411522630",
  );
});

test("parse accepts integers and fractions", () => {
  assert.equal(Fraction.parse("3").toString(), "3");
  assert.equal(Fraction.parse("-2").toString(), "-2");
  assert.equal(Fraction.parse("1/2").toString(), "1/2");
  assert.equal(Fraction.parse("-3/4").toString(), "-3/4");
  assert.equal(Fraction.parse("6/8").toString(), "3/4");
  assert.equal(Fraction.parse("2/-4").toString(), "-1/2");
  assert.equal(Fraction.parse("  7/9  ").toString(), "7/9");
});

test("parse rejects zero denominators", () => {
  assert.throws(() => Fraction.parse("0/0"), /zero/i);
  assert.throws(() => Fraction.parse("1/0"), /zero/i);
});

test("parse rejects malformed input", () => {
  for (const input of ["1.5", "", "1/2/3", "  ", "abc", "1 / 2", "+", "-", "1/-"]) {
    assert.throws(
      () => Fraction.parse(input),
      (error) => error instanceof TypeError,
      `expected parse to reject ${JSON.stringify(input)}`,
    );
  }
});

test("parse rejects non-string input", () => {
  assert.throws(() => Fraction.parse(1), TypeError);
  assert.throws(() => Fraction.parse(null), TypeError);
});

test("constructor rejects non-integer numbers and non-numeric values", () => {
  assert.throws(() => f(1.5, 2), /safe integer/);
  assert.throws(() => f(1, 0.5), /safe integer/);
  assert.throws(() => f("1", "2"), /safe integer/);
});
