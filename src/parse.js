import { Fraction } from "./fraction.js";

const MIN_ROWS = 2;
const MAX_ROWS = 6;
const ROW_SEPARATOR = /[\r\n;]+/;
const CELL_SEPARATOR = /[\s,]+/;

/**
 * Parse pasted matrix text into raw cell strings.
 *
 * Rows are separated by newlines or semicolons. Cells are separated by
 * whitespace, commas, or tabs. A pipe is treated as a cell separator; it is
 * intended to mark the boundary before the constant column.
 *
 * Every cell is validated with Fraction.parse, but the returned rows contain
 * the original token strings so the input cells can be edited afterwards.
 */
export function parseMatrixText(text) {
  if (typeof text !== "string") {
    throw new TypeError("Paste a matrix as text.");
  }

  const rawRows = text
    .split(ROW_SEPARATOR)
    .map((row) => row.trim())
    .filter((row) => row !== "");

  if (rawRows.length === 0) {
    throw new Error("Paste a matrix first.");
  }

  if (rawRows.length < MIN_ROWS || rawRows.length > MAX_ROWS) {
    throw new Error(
      `Expected between ${MIN_ROWS} and ${MAX_ROWS} rows, found ${rawRows.length}.`,
    );
  }

  const expectedEntries = rawRows.length + 1;
  const rows = rawRows.map((rawRow, rowIndex) => {
    const cells = rawRow
      .replace(/\|/g, " ")
      .trim()
      .split(CELL_SEPARATOR)
      .filter((cell) => cell !== "");

    if (cells.length !== expectedEntries) {
      throw new Error(
        `Row ${rowIndex + 1} has ${cells.length} entries, expected ${expectedEntries}`,
      );
    }

    cells.forEach((cell, columnIndex) => {
      try {
        Fraction.parse(cell);
      } catch {
        throw new Error(
          `Row ${rowIndex + 1}, column ${columnIndex + 1}: invalid value '${cell}'`,
        );
      }
    });

    return cells;
  });

  return { size: rows.length, rows };
}
