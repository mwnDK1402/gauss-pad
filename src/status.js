/**
 * Factual status classification for the augmented matrix.
 *
 * This module answers only "what is the current state of this matrix?".
 * It never chooses, ranks, or recommends row operations. In particular the
 * singularity check is an internal exact determinant calculation used for
 * classification; it is not exposed as a solving step.
 */

import { Fraction, ZERO } from "./fraction.js";
import { matrixDimensions } from "./matrix.js";

function coefficientEntries(row) {
  return row.slice(0, -1);
}

function isZeroRow(row) {
  return coefficientEntries(row).every((entry) => entry.isZero());
}

function isIdentity(matrix) {
  const n = matrix.length;
  for (let row = 0; row < n; row += 1) {
    for (let column = 0; column < n; column += 1) {
      const entry = matrix[row][column];
      if (row === column) {
        if (!entry.isOne()) return false;
      } else if (!entry.isZero()) {
        return false;
      }
    }
  }
  return true;
}

function isInconsistent(matrix) {
  return matrix.some(
    (row) => isZeroRow(row) && !row[row.length - 1].isZero(),
  );
}

function determinant(matrix) {
  const n = matrix.length;

  if (n === 1) {
    return matrix[0][0];
  }

  let result = ZERO;
  for (let column = 0; column < n; column += 1) {
    const entry = matrix[0][column];
    if (entry.isZero()) continue;

    const minor = matrix
      .slice(1)
      .map((row) => row.filter((_, index) => index !== column));
    const term = entry.mul(determinant(minor));
    result = column % 2 === 0 ? result.add(term) : result.sub(term);
  }
  return result;
}

function isSingular(matrix) {
  const coefficients = matrix.map(coefficientEntries);
  return determinant(coefficients).isZero();
}

/**
 * @param {Fraction[][]} matrix square augmented matrix, n rows by n + 1 columns
 * @returns {"solved"|"inconsistent"|"singular"|"inProgress"}
 */
export function classify(matrix) {
  const { rows, columns } = matrixDimensions(matrix);
  if (columns !== rows + 1) {
    throw new RangeError(
      "Status classification requires a square augmented matrix.",
    );
  }

  if (isIdentity(matrix)) return "solved";
  if (isInconsistent(matrix)) return "inconsistent";
  if (isSingular(matrix)) return "singular";
  return "inProgress";
}
