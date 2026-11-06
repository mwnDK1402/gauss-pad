import test from "node:test";
import assert from "node:assert/strict";

import { parseMatrixText } from "./parse.js";

const sample = [
  ["3", "0", "0", "60"],
  ["1", "2", "0", "30"],
  ["0", "1", "-2", "3"],
];

test("the three supported formats produce the same matrix", () => {
  const whitespace = parseMatrixText(
    ["3 0 0 60", "1 2 0 30", "0 1 -2 3"].join("\n"),
  );
  const commasAndSemicolons = parseMatrixText(
    "3, 0, 0, 60; 1, 2, 0, 30; 0, 1, -2, 3",
  );
  const pipes = parseMatrixText(
    ["3 0 0 | 60", "1 2 0 | 30", "0 1 -2 | 3"].join("\n"),
  );

  assert.deepEqual(whitespace, { size: 3, rows: sample });
  assert.deepEqual(commasAndSemicolons, { size: 3, rows: sample });
  assert.deepEqual(pipes, { size: 3, rows: sample });
});

test("parses a 2x3 matrix", () => {
  assert.deepEqual(parseMatrixText("1 2 3\n4 5 6"), {
    size: 2,
    rows: [
      ["1", "2", "3"],
      ["4", "5", "6"],
    ],
  });
});

test("parses a 6x7 matrix", () => {
  const rows = [
    ["1", "2", "3", "4", "5", "6", "7"],
    ["8", "9", "10", "11", "12", "13", "14"],
    ["15", "16", "17", "18", "19", "20", "21"],
    ["22", "23", "24", "25", "26", "27", "28"],
    ["29", "30", "31", "32", "33", "34", "35"],
    ["36", "37", "38", "39", "40", "41", "42"],
  ];

  assert.deepEqual(parseMatrixText(rows.map((row) => row.join(" ")).join(";")), {
    size: 6,
    rows,
  });
});

test("rejects a single row", () => {
  assert.throws(
    () => parseMatrixText("1 2"),
    /Expected between 2 and 6 rows, found 1/,
  );
});

test("rejects seven rows", () => {
  assert.throws(
    () => parseMatrixText("1\n2\n3\n4\n5\n6\n7"),
    /Expected between 2 and 6 rows, found 7/,
  );
});

test("rejects ragged rows and names the offending row", () => {
  assert.throws(
    () => parseMatrixText("1 2 3 4\n5 6 7\n8 9 10 11"),
    /Row 2 has 3 entries, expected 4/,
  );
});

test("rejects a non-numeric cell and names its row and column", () => {
  assert.throws(
    () => parseMatrixText("1 2 3\n4 x 6"),
    /Row 2, column 2: invalid value 'x'/,
  );
});

test("rejects empty input", () => {
  assert.throws(() => parseMatrixText("   \n\t "), /Paste a matrix first/);
});

test("rejects a lone pipe", () => {
  assert.throws(() => parseMatrixText("|"));
});
