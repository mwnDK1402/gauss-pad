# Gauss Pad

A manual Gaussian-elimination workbench. You enter an augmented matrix, then
apply elementary row operations yourself, one at a time, until the coefficient
part is the identity matrix.

Gauss Pad never chooses operations, highlights pivots, auto-reduces, suggests a
next step, or solves the system on its own. It applies exactly the operation you
submit and reports the resulting matrix and status.

## Requirements

- Node.js with ES modules and `node --test` support
- npm
- The only devDependency is **esbuild 0.28.2**, pinned exactly

The generated `dist/index.html` has no runtime dependencies and no network
references.

## Setup, tests, and build

```sh
npm install
npm test
npm run build
```

`npm test` runs the Node suite in `src/*.test.js`. `npm run build` bundles the
application with esbuild's JavaScript API and writes `dist/index.html`.

Open the built workbench directly in a browser:

```sh
# Linux example
xdg-open dist/index.html
```

Alternatively open `dist/index.html` from the browser's file menu.

## Browser smoke test

Open the built file with the `test` query parameter:

```text
dist/index.html?test
```

For example:

```sh
xdg-open 'dist/index.html?test'
```

The page runs 18 browser-only assertions against the same Fraction, matrix,
and status modules the UI uses, then shows a pass/fail summary. This test exists
to catch bundling problems; the Node suite is the real logic test suite.

## Verify the single-file build

```sh
grep -c 'script src\|link rel' dist/index.html
# 0
```

To check for any external references:

```sh
grep -nE 'https?://|<link|<script[^>]+src|@import|url\(|sourceMappingURL' dist/index.html
# no output
```

## Input rules

- Choose `n` from 2 to 6. The start value is 3.
- Cells accept exact integers and fractions: `3`, `-2`, `1/2`, `-3/4`.
- Decimals, empty cells, malformed fractions, and zero denominators produce an
  inline cell error.
- The coefficient columns are labelled with `x`, `y`, `z`, `w`, `u`, `v`; the
  final column is the constant column `b`.
- Press **Start** to lock the input. Working-mode entries are read-only and
  change only through submitted row operations.

## Operation widgets

All rows are selected with dropdowns. Factors use the same exact-fraction
parser as matrix cells.

- **Swap rows**: choose rows `i` and `j`, then click **Swap rows**.
- **Scale a row**: choose row `i` and nonzero factor `c`, then click
  **Scale row**. A zero factor is rejected.
- **Add a row multiple**: choose target row `i`, source row `j` (`i != j`), and
  factor `c`, then click **Add multiple**. The operation is
  `Ri <- Ri + c*Rj`.

Every operation applies to the entire row, including the constant column.
**Undo** steps back one operation. **Reset** returns to input mode with the
entries from the most recent Start.

## Status meanings

- **Solved**: the coefficient part is exactly the identity matrix. Variable
  values and the solution vector are shown from the constant column.
- **Inconsistent: no solution.**: a visible row is
  `(0 ... 0 | c)` with `c != 0`.
- **Singular**: the coefficient matrix is singular, so there is no unique
  solution. The coefficient part cannot become the identity matrix.
- **In progress**: the coefficient part is not yet the identity matrix.

The inconsistent classification is based on the current row form, as displayed.
Gauss Pad does not reduce the matrix behind the scenes to expose a contradiction
for you.

## Reproducible sanity checks

The cell names below mean the coefficient columns and the constant column `b`.
For example, `R2, y = 2` means row 2, column `y`. Every sequence starts from a
freshly opened `dist/index.html`.

### A. Three equations, three unknowns

Expected result: `x = 20`, `y = 5`, `z = 1`.

1. Leave **Size n** at `3`.
2. Enter the matrix:

   | row | x | y | z | b |
   | --- | --- | --- | --- | --- |
   | R1 | 3 | 0 | 0 | 60 |
   | R2 | 1 | 2 | 0 | 30 |
   | R3 | 0 | 1 | -2 | 3 |

3. Click **Start**. Status: **In progress**.
4. **Scale a row** → Row i `R1`, Factor c `1/3` → **Scale row**.
5. **Add a row multiple** → Target `R2`, Source `R1`, Factor c `-1` →
   **Add multiple**.
6. **Scale a row** → Row i `R2`, Factor c `1/2` → **Scale row**.
7. **Add a row multiple** → Target `R3`, Source `R2`, Factor c `-1` →
   **Add multiple**.
8. **Scale a row** → Row i `R3`, Factor c `-1/2` → **Scale row**.

Status becomes **Solved**, with `x = 20, y = 5, z = 1` and solution vector
`(20, 5, 1)`.

### B. Two equations, two unknowns

Expected result: `x = 5/7`, `y = -13/14`.

1. Set **Size n** to `2`.
2. Enter the matrix:

   | row | x | y | b |
   | --- | --- | --- | --- |
   | R1 | 3 | -2 | 4 |
   | R2 | 1 | 4 | -3 |

3. Click **Start**. Status: **In progress**.
4. **Swap rows** → Row i `R1`, Row j `R2` → **Swap rows**.
5. **Add a row multiple** → Target `R2`, Source `R1`, Factor c `-3` →
   **Add multiple**.
6. **Scale a row** → Row i `R2`, Factor c `-1/14` → **Scale row**.
7. **Add a row multiple** → Target `R1`, Source `R2`, Factor c `-4` →
   **Add multiple**.

Status becomes **Solved**, with `x = 5/7, y = -13/14`.

### C. Inconsistent system

Expected result: **Inconsistent: no solution.**

1. Leave **Size n** at `3`.
2. Enter the matrix:

   | row | x | y | z | b |
   | --- | --- | --- | --- | --- |
   | R1 | 1 | 1 | 1 | 2 |
   | R2 | 2 | 2 | 2 | 5 |
   | R3 | 1 | -1 | 0 | 0 |

3. Click **Start**. Status: **Singular**. No visible row is yet
   `(0 ... 0 | c)`, so the contradiction has not been exposed.
4. **Add a row multiple** → Target `R2`, Source `R1`, Factor c `-2` →
   **Add multiple**.

Row 2 becomes `0 0 0 | 1`, and the status becomes
**Inconsistent: no solution.**

### D. Singular coefficient matrix

Expected result: **Singular**, no unique solution.

1. Set **Size n** to `2`.
2. Enter the matrix:

   | row | x | y | b |
   | --- | --- | --- | --- |
   | R1 | 1 | 2 | 3 |
   | R2 | 2 | 4 | 6 |

3. Click **Start**. Status: **Singular**.
4. Optional: **Add a row multiple** → Target `R2`, Source `R1`, Factor c `-2`
   → **Add multiple**. Row 2 becomes `0 0 | 0`; the status remains
   **Singular**.

## Project layout

```text
package.json
build.js
template.html
README.md
.gitignore
src/
  fraction.js
  fraction.test.js
  matrix.js
  matrix.test.js
  status.js
  status.test.js
  ui.js
  main.js
  selftest.js
  style.css
dist/
  index.html          generated by npm run build, not committed
```

`build.js` calls `esbuild.build()` with `bundle: true`, `format: "iife"`,
`target: "es2020"`, `minify: false`, and `write: false`. It then inlines
`src/style.css` and the bundle into `template.html`, escaping any literal
`</script>` in the bundle before writing `dist/index.html`.
