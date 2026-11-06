/**
 * Browser-only smoke test, available at ?test.
 *
 * This is intentionally small. It checks that the bundled modules load and
 * interoperate; the Node suite is the real logic test suite.
 */

import { Fraction } from "./fraction.js";
import { addRowMultiple, scaleRow, swapRows } from "./matrix.js";
import { classify } from "./status.js";

function matrix(rows) {
  return rows.map((row) => row.map((value) => Fraction.parse(value)));
}

function strings(matrixValue) {
  return matrixValue.map((row) =>
    row.map((entry) => entry.toString()),
  );
}

export function runSelfTest(root) {
  const results = [];

  function check(name, callback) {
    try {
      callback();
      results.push({ name, ok: true, message: "" });
    } catch (error) {
      results.push({
        name,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function equal(actual, expected) {
    if (actual !== expected) {
      throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }

  function deepEqual(actual, expected) {
    const actualText = JSON.stringify(actual);
    const expectedText = JSON.stringify(expected);
    if (actualText !== expectedText) {
      throw new Error(`expected ${expectedText}, got ${actualText}`);
    }
  }

  function throws(callback) {
    try {
      callback();
    } catch {
      return;
    }
    throw new Error("expected an exception, but none was thrown");
  }

  check("Fraction.parse integer", () => {
    equal(Fraction.parse("3").toString(), "3");
  });

  check("Fraction.parse negative fraction", () => {
    equal(Fraction.parse("-3/4").toString(), "-3/4");
  });

  check("Fraction.parse reduces", () => {
    equal(Fraction.parse("6/8").toString(), "3/4");
  });

  check("Fraction.parse rejects decimals", () => {
    throws(() => Fraction.parse("1.5"));
  });

  check("Fraction.parse rejects zero denominators", () => {
    throws(() => Fraction.parse("1/0"));
  });

  check("Fraction addition", () => {
    equal(Fraction.parse("1/2").add(Fraction.parse("1/3")).toString(), "5/6");
  });

  check("Fraction addition cancels to zero", () => {
    equal(Fraction.parse("1/2").add(Fraction.parse("-1/2")).toString(), "0");
  });

  check("Fraction subtraction", () => {
    equal(Fraction.parse("3/4").sub(Fraction.parse("1/4")).toString(), "1/2");
  });

  check("swapRows swaps whole rows", () => {
    const start = matrix([
      ["1", "2", "3", "4"],
      ["5", "6", "7", "8"],
    ]);
    deepEqual(strings(swapRows(start, 0, 1)), [
      ["5", "6", "7", "8"],
      ["1", "2", "3", "4"],
    ]);
  });

  check("scaleRow scales the constant column", () => {
    const start = matrix([
      ["1", "2", "3", "4"],
      ["5", "6", "7", "8"],
    ]);
    deepEqual(strings(scaleRow(start, 0, Fraction.parse("1/2"))), [
      ["1/2", "1", "3/2", "2"],
      ["5", "6", "7", "8"],
    ]);
  });

  check("scaleRow rejects a zero factor", () => {
    const start = matrix([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
    throws(() => scaleRow(start, 0, Fraction.parse("0")));
  });

  check("addRowMultiple updates the whole target row", () => {
    const start = matrix([
      ["1", "2", "3", "4"],
      ["5", "6", "7", "8"],
    ]);
    deepEqual(strings(addRowMultiple(start, 1, 0, Fraction.parse("-1"))), [
      ["1", "2", "3", "4"],
      ["4", "4", "4", "4"],
    ]);
  });

  check("addRowMultiple rejects i === j", () => {
    const start = matrix([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
    throws(() => addRowMultiple(start, 0, 0, Fraction.parse("2")));
  });

  check("row operations do not mutate the input", () => {
    const start = matrix([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
    scaleRow(start, 0, Fraction.parse("2"));
    addRowMultiple(start, 1, 0, Fraction.parse("3"));
    swapRows(start, 0, 1);
    deepEqual(strings(start), [
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  check("classify solved", () => {
    equal(
      classify(
        matrix([
          ["1", "0", "4"],
          ["0", "1", "5"],
        ]),
      ),
      "solved",
    );
  });

  check("classify inconsistent", () => {
    equal(
      classify(
        matrix([
          ["1", "1", "2"],
          ["0", "0", "3"],
        ]),
      ),
      "inconsistent",
    );
  });

  check("classify singular", () => {
    equal(
      classify(
        matrix([
          ["1", "2", "3"],
          ["2", "4", "6"],
        ]),
      ),
      "singular",
    );
  });

  check("classify inProgress", () => {
    equal(
      classify(
        matrix([
          ["2", "0", "1"],
          ["0", "1", "2"],
        ]),
      ),
      "inProgress",
    );
  });

  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;

  const title = document.createElement("h1");
  title.textContent = "Browser smoke test";

  const summary = document.createElement("p");
  summary.className = `smoke-summary ${
    failed === 0 ? "smoke-summary--pass" : "smoke-summary--fail"
  }`;
  summary.textContent = `${passed} passed, ${failed} failed, ${results.length} total`;

  const list = document.createElement("ol");
  list.className = "smoke-list";

  for (const result of results) {
    const item = document.createElement("li");
    item.className = result.ok ? "smoke-pass" : "smoke-fail";

    const name = document.createElement("span");
    name.className = "smoke-name";
    name.textContent = result.name;

    item.append(name);

    if (!result.ok) {
      const message = document.createElement("span");
      message.className = "smoke-message";
      message.textContent = result.message;
      item.append(message);
    }

    list.append(item);
  }

  const container = document.createElement("section");
  container.className = "smoke-test";
  container.append(title, summary, list);

  root.replaceChildren(container);
  document.title = "Gauss Pad — Browser smoke test";

  globalThis.__GAUSS_PAD_SMOKE__ = {
    passed,
    failed,
    total: results.length,
    results,
  };

  return { passed, failed, total: results.length, results };
}
