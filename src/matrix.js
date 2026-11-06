/**
 * An augmented matrix is a rectangular 2D array of Fractions. The final
 * column is the constant column; every row operation applies to the entire
 * row, including that column.
 *
 * Every function here is pure: it validates its arguments, returns a fresh
 * matrix, and never mutates the matrix it was given.
 */

import { Fraction } from "./fraction.js";

function assertMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new TypeError("Matrix must be a non-empty array of rows.");
  }

  const columns = matrix[0].length;
  if (!Array.isArray(matrix[0]) || columns === 0) {
    throw new TypeError("Matrix rows must be non-empty arrays.");
  }

  for (const row of matrix) {
    if (!Array.isArray(row) || row.length !== columns) {
      throw new TypeError("Matrix rows must all have the same length.");
    }
    for (const entry of row) {
      if (!(entry instanceof Fraction)) {
        throw new TypeError("Matrix entries must be Fractions.");
      }
    }
  }
}

function assertRowIndex(matrix, index, label) {
  if (!Number.isInteger(index) || index < 0 || index >= matrix.length) {
    throw new RangeError(`${label} row index ${index} is out of range.`);
  }
}

function assertDistinctRows(i, j) {
  if (i === j) {
    throw new RangeError("Source and target rows must be different.");
  }
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

export function matrixDimensions(matrix) {
  assertMatrix(matrix);
  return { rows: matrix.length, columns: matrix[0].length };
}

export function swapRows(matrix, i, j) {
  assertMatrix(matrix);
  assertRowIndex(matrix, i, "First");
  assertRowIndex(matrix, j, "Second");

  const next = cloneMatrix(matrix);
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function scaleRow(matrix, i, factor) {
  assertMatrix(matrix);
  assertRowIndex(matrix, i, "Scaled");
  if (!(factor instanceof Fraction)) {
    throw new TypeError("Scale factor must be a Fraction.");
  }
  if (factor.isZero()) {
    throw new RangeError("Scale factor must not be zero.");
  }

  const next = cloneMatrix(matrix);
  next[i] = next[i].map((entry) => entry.mul(factor));
  return next;
}

export function addRowMultiple(matrix, target, source, factor) {
  assertMatrix(matrix);
  assertRowIndex(matrix, target, "Target");
  assertRowIndex(matrix, source, "Source");
  assertDistinctRows(target, source);
  if (!(factor instanceof Fraction)) {
    throw new TypeError("Add-multiple factor must be a Fraction.");
  }

  const next = cloneMatrix(matrix);
  next[target] = next[target].map((entry, column) =>
    entry.add(factor.mul(next[source][column])),
  );
  return next;
}
