import test from "node:test";
import assert from "node:assert/strict";

import { Fraction } from "./fraction.js";
import {
  addRowMultiple,
  matrixDimensions,
  scaleRow,
  swapRows,
} from "./matrix.js";

const f = (n, d = 1n) => new Fraction(n, d);
const row = (...values) => values.map((value) => f(value));
const clone = (matrix) => matrix.map((r) => r.slice());
const strings = (matrix) =>
  matrix.map((r) => r.map((entry) => entry.toString()));

const base = [
  row(1, 2, 3, 4),
  row(5, 6, 7, 8),
  row(9, 10, 11, 12),
];

test("matrixDimensions reports rows and columns", () => {
  assert.deepEqual(matrixDimensions(base), { rows: 3, columns: 4 });
});

test("swapRows swaps complete rows", () => {
  const result = swapRows(base, 0, 2);
  assert.deepEqual(strings(result), [
    ["9", "10", "11", "12"],
    ["5", "6", "7", "8"],
    ["1", "2", "3", "4"],
  ]);
});

test("swapRows returns a new matrix", () => {
  const before = clone(base);
  const result = swapRows(base, 0, 1);

  assert.notEqual(result, base);
  result.forEach((r, index) => assert.notEqual(r, base[index]));
  assert.deepEqual(base, before);
});

test("swapRows with equal indices is a valid no-op", () => {
  const result = swapRows(base, 1, 1);
  assert.deepEqual(strings(result), strings(base));
  assert.deepEqual(base, clone(base));
});

test("scaleRow multiplies the whole row including the constant column", () => {
  const result = scaleRow(base, 1, f(-3, 2));
  assert.deepEqual(strings(result), [
    ["1", "2", "3", "4"],
    ["-15/2", "-9", "-21/2", "-12"],
    ["9", "10", "11", "12"],
  ]);
});

test("scaleRow accepts one and negative factors", () => {
  assert.deepEqual(strings(scaleRow(base, 0, f(1))), strings(base));
  assert.deepEqual(strings(scaleRow(base, 2, f(-1))), [
    ["1", "2", "3", "4"],
    ["5", "6", "7", "8"],
    ["-9", "-10", "-11", "-12"],
  ]);
});

test("scaleRow rejects a zero factor", () => {
  assert.throws(() => scaleRow(base, 0, f(0)), /must not be zero/);
  assert.throws(() => scaleRow(base, 1, f(0, 7)), /must not be zero/);
});

test("scaleRow returns a new matrix without mutating the input", () => {
  const before = clone(base);
  const result = scaleRow(base, 0, f(2));

  assert.notEqual(result, base);
  result.forEach((r, index) => assert.notEqual(r, base[index]));
  assert.deepEqual(base, before);
});

test("addRowMultiple adds a source-row multiple to the target row", () => {
  const result = addRowMultiple(base, 0, 1, f(-2));
  assert.deepEqual(strings(result), [
    ["-9", "-10", "-11", "-12"],
    ["5", "6", "7", "8"],
    ["9", "10", "11", "12"],
  ]);
});

test("addRowMultiple handles fractional factors and the constant column", () => {
  const result = addRowMultiple(base, 2, 0, f(1, 2));
  assert.deepEqual(strings(result), [
    ["1", "2", "3", "4"],
    ["5", "6", "7", "8"],
    ["19/2", "11", "25/2", "14"],
  ]);
});

test("addRowMultiple with a zero factor is a no-op", () => {
  assert.deepEqual(strings(addRowMultiple(base, 0, 2, f(0))), strings(base));
});

test("addRowMultiple rejects using the target row as its own source", () => {
  assert.throws(
    () => addRowMultiple(base, 1, 1, f(2)),
    /must be different/,
  );
});

test("addRowMultiple returns a new matrix without mutating the input", () => {
  const before = clone(base);
  const result = addRowMultiple(base, 1, 2, f(3));

  assert.notEqual(result, base);
  result.forEach((r, index) => assert.notEqual(r, base[index]));
  assert.deepEqual(base, before);
});

test("operations reject invalid row indices", () => {
  assert.throws(() => swapRows(base, -1, 0), RangeError);
  assert.throws(() => swapRows(base, 0, 3), RangeError);
  assert.throws(() => scaleRow(base, 7, f(1)), RangeError);
  assert.throws(() => addRowMultiple(base, 0, 9, f(1)), RangeError);
});

test("operations reject malformed matrices and wrong factor types", () => {
  assert.throws(() => swapRows([], 0, 1), TypeError);
  assert.throws(() => swapRows([[f(1)], [f(1), f(2)]], 0, 1), TypeError);
  assert.throws(() => swapRows([[1, 2]], 0, 1), TypeError);
  assert.throws(() => scaleRow(base, 0, 2), TypeError);
  assert.throws(() => addRowMultiple(base, 0, 1, 2), TypeError);
});

test("fractions in the input matrix are never mutated", () => {
  const matrix = [row(1, 2, 3), row(4, 5, 6)];
  const firstEntry = matrix[0][0];
  scaleRow(matrix, 0, f(5));
  assert.equal(firstEntry.toString(), "1");
  assert.equal(matrix[0][0], firstEntry);
});
