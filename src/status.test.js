import test from "node:test";
import assert from "node:assert/strict";

import { Fraction } from "./fraction.js";
import {
  addRowMultiple,
  scaleRow,
  swapRows,
} from "./matrix.js";
import { classify } from "./status.js";

const matrix = (rows) =>
  rows.map((row) => row.map((value) => Fraction.parse(value)));

const apply = (start, operations) =>
  operations.reduce((current, operation) => operation(current), start);

const f = (n, d = 1n) => new Fraction(n, d);

test("sanity A: entry is inProgress and the reference sequence reaches solved", () => {
  const start = matrix([
    ["3", "0", "0", "60"],
    ["1", "2", "0", "30"],
    ["0", "1", "-2", "3"],
  ]);

  assert.equal(classify(start), "inProgress");

  const steps = [
    (m) => scaleRow(m, 0, f(1, 3)),
    (m) => addRowMultiple(m, 1, 0, f(-1)),
    (m) => scaleRow(m, 1, f(1, 2)),
    (m) => addRowMultiple(m, 2, 1, f(-1)),
    (m) => scaleRow(m, 2, f(-1, 2)),
  ];

  assert.equal(classify(apply(start, steps.slice(0, 1))), "inProgress");
  assert.equal(classify(apply(start, steps.slice(0, 2))), "inProgress");
  assert.equal(classify(apply(start, steps.slice(0, 3))), "inProgress");
  assert.equal(classify(apply(start, steps.slice(0, 4))), "inProgress");

  const solved = apply(start, steps);
  assert.equal(classify(solved), "solved");
  assert.equal(solved[0][3].toString(), "20");
  assert.equal(solved[1][3].toString(), "5");
  assert.equal(solved[2][3].toString(), "1");
});

test("sanity B: entry is inProgress and the reference sequence reaches solved", () => {
  const start = matrix([
    ["3", "-2", "4"],
    ["1", "4", "-3"],
  ]);

  assert.equal(classify(start), "inProgress");

  const steps = [
    (m) => swapRows(m, 0, 1),
    (m) => addRowMultiple(m, 1, 0, f(-3)),
    (m) => scaleRow(m, 1, f(-1, 14)),
    (m) => addRowMultiple(m, 0, 1, f(-4)),
  ];

  assert.equal(classify(apply(start, steps.slice(0, 1))), "inProgress");
  assert.equal(classify(apply(start, steps.slice(0, 2))), "inProgress");
  assert.equal(classify(apply(start, steps.slice(0, 3))), "inProgress");

  const solved = apply(start, steps);
  assert.equal(classify(solved), "solved");
  assert.equal(solved[0][2].toString(), "5/7");
  assert.equal(solved[1][2].toString(), "-13/14");
});

test("sanity C: singular at entry, inconsistent once the contradiction is exposed", () => {
  const start = matrix([
    ["1", "1", "1", "2"],
    ["2", "2", "2", "5"],
    ["1", "-1", "0", "0"],
  ]);

  // No row is yet (0 ... 0 | c), so the visible state is singular. The
  // contradiction only appears after the user performs a row operation.
  assert.equal(classify(start), "singular");

  const steps = [
    (m) => addRowMultiple(m, 1, 0, f(-2)),
    (m) => swapRows(m, 1, 2),
    (m) => scaleRow(m, 0, f(2)),
  ];

  assert.equal(classify(apply(start, steps.slice(0, 1))), "inconsistent");
  assert.equal(classify(apply(start, steps.slice(0, 2))), "inconsistent");
  assert.equal(classify(apply(start, steps)), "inconsistent");
});

test("sanity D: singular at entry and remains singular", () => {
  const start = matrix([
    ["1", "2", "3"],
    ["2", "4", "6"],
  ]);

  assert.equal(classify(start), "singular");

  const steps = [
    (m) => addRowMultiple(m, 1, 0, f(-2)),
    (m) => scaleRow(m, 0, f(2)),
  ];

  assert.equal(classify(apply(start, steps.slice(0, 1))), "singular");
  assert.equal(classify(apply(start, steps)), "singular");
});

test("solved takes precedence and uses exact identity checks", () => {
  const solved = matrix([
    ["1", "0", "0", "2"],
    ["0", "1", "0", "-3"],
    ["0", "0", "1", "1/2"],
  ]);

  assert.equal(classify(solved), "solved");
});

test("an inconsistent zero row is classified before singularity", () => {
  const inconsistent = matrix([
    ["1", "1", "2"],
    ["0", "0", "3"],
  ]);

  // The coefficient matrix is singular, but the visible contradiction is the
  // more specific factual status.
  assert.equal(classify(inconsistent), "inconsistent");
});

test("a consistent dependent system is singular, not inconsistent", () => {
  const dependent = matrix([
    ["1", "1", "2"],
    ["2", "2", "4"],
  ]);

  assert.equal(classify(dependent), "singular");
});

test("a nonsingular non-identity matrix is inProgress", () => {
  const working = matrix([
    ["2", "0", "1"],
    ["0", "1", "2"],
  ]);

  assert.equal(classify(working), "inProgress");
});

test("classification requires a square augmented matrix", () => {
  assert.throws(
    () => classify(matrix([["1", "2", "3", "4"]])),
    /square augmented matrix/,
  );
  assert.throws(
    () =>
      classify(
        matrix([
          ["1", "2"],
          ["3", "4"],
        ]),
      ),
    /square augmented matrix/,
  );
});

test("classification rejects malformed matrices", () => {
  assert.throws(() => classify([]), TypeError);
  assert.throws(() => classify([["1", "2", "3"]]), TypeError);
  assert.throws(
    () =>
      classify([
        [f(1), f(0), f(0)],
        [f(0), f(1)],
      ]),
    TypeError,
  );
});
