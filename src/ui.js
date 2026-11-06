import { Fraction, ONE } from "./fraction.js";
import { addRowMultiple, scaleRow, swapRows } from "./matrix.js";
import { classify } from "./status.js";

const VARIABLES = ["x", "y", "z", "w", "u", "v"];
const MIN_SIZE = 2;
const MAX_SIZE = 6;
const DEFAULT_SIZE = 3;
const NEGATIVE_ONE = new Fraction(-1n);
const QUICK_FACTORS = ["-1", "1", "1/2", "1/3", "1/4", "2", "3", "-2"];
const FLASH_DURATION = 320;

function node(tagName, properties = {}, ...children) {
  const element = document.createElement(tagName);

  for (const [key, value] of Object.entries(properties)) {
    if (value == null || value === false) continue;

    if (key === "class") {
      element.className = value;
    } else if (key === "text") {
      element.textContent = value;
    } else if (key === "value") {
      element.value = value;
    } else if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      element.setAttribute(key, "");
    } else {
      element.setAttribute(key, String(value));
    }
  }

  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    element.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }

  return element;
}

function blankValues(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size + 1 }, () => "0"),
  );
}

function cloneValues(values) {
  return values.map((row) => row.slice());
}

function variableLabels(size) {
  return VARIABLES.slice(0, size);
}

function initialState() {
  return {
    mode: "input",
    size: DEFAULT_SIZE,
    inputValues: blankValues(DEFAULT_SIZE),
    lockedValues: null,
    matrix: null,
    history: [],
    past: [],
    cellErrors: {},
    selection: [],
    scaleFactor: "",
    addFactors: { first: "", second: "" },
    operationError: null,
  };
}

function parseOperationFactor(raw, { nonzero = false } = {}) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("Enter a factor.");
  }

  let factor;
  try {
    factor = Fraction.parse(raw);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error("The factor has a zero denominator.");
    }
    throw new Error("Enter an integer or exact fraction, such as -2 or 1/2.");
  }

  if (nonzero && factor.isZero()) {
    throw new Error("The scale factor must not be zero.");
  }

  return factor;
}

function cellErrorMessage(raw, error) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return "Required.";
  }
  if (error instanceof RangeError) {
    return "Denominator cannot be 0.";
  }
  return "Use an integer or fraction.";
}

function formatSwap(i, j) {
  return `R${i + 1} <-> R${j + 1}`;
}

function formatScale(i, factor) {
  return `R${i + 1} <- ${factor.toString()}*R${i + 1}`;
}

function formatAddMultiple(target, source, factor) {
  const targetLabel = `R${target + 1}`;
  const sourceLabel = `R${source + 1}`;

  if (factor.equals(ONE)) {
    return `${targetLabel} <- ${targetLabel} + ${sourceLabel}`;
  }
  if (factor.equals(NEGATIVE_ONE)) {
    return `${targetLabel} <- ${targetLabel} - ${sourceLabel}`;
  }
  if (factor.isNegative()) {
    return `${targetLabel} <- ${targetLabel} - ${factor.neg().toString()}*${sourceLabel}`;
  }
  return `${targetLabel} <- ${targetLabel} + ${factor.toString()}*${sourceLabel}`;
}

export function mountApp(root) {
  if (!(root instanceof Element)) {
    throw new TypeError("mountApp requires a root element.");
  }

  const state = initialState();

  function captureFocusKey() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
    return active.dataset.focusKey ?? (active.id ? `#${active.id}` : null);
  }

  function focusByKey(key) {
    if (!key) return;

    const element = key.startsWith("#")
      ? document.getElementById(key.slice(1))
      : root.querySelector(`[data-focus-key="${key}"]`);

    if (element instanceof HTMLElement) {
      element.focus({ preventScroll: true });
    }
  }

  function flashRows(indices) {
    const elements = [...new Set(indices)]
      .map((index) => root.querySelector(`tr[data-row="${index}"]`))
      .filter((element) => element instanceof HTMLElement);

    elements.forEach((element) => element.classList.add("matrix-row--flash"));

    window.setTimeout(() => {
      elements.forEach((element) =>
        element.classList.remove("matrix-row--flash"),
      );
    }, FLASH_DURATION);
  }

  function render(options = {}) {
    const {
      focusKey,
      restoreFocus = true,
      flashRows: rowsToFlash = [],
    } = options;
    const activeKey = restoreFocus ? captureFocusKey() : null;

    const app = node(
      "div",
      { class: "app-shell" },
      renderHeader(state),
      node(
        "main",
        { class: "workspace" },
        renderMatrixPanel(state, actions),
        renderOperationBar(state, actions),
        node(
          "aside",
          { class: "sidebar" },
          renderStatusPanel(state),
          renderHistoryPanel(state),
          renderLegendPanel(),
        ),
      ),
      node(
        "footer",
        { class: "app-footer" },
        "Exact rational arithmetic. Every committed operation is applied only when you submit it.",
      ),
    );

    root.replaceChildren(app);

    const historyList = root.querySelector(".history-list");
    if (historyList) {
      historyList.scrollTop = historyList.scrollHeight;
    }

    const targetFocus = focusKey !== undefined ? focusKey : activeKey;
    if (targetFocus) focusByKey(targetFocus);
    if (rowsToFlash.length > 0) flashRows(rowsToFlash);
  }

  function resetOperationInputs() {
    state.scaleFactor = "";
    state.addFactors = { first: "", second: "" };
    state.operationError = null;
  }

  function clearOperationError(kind) {
    if (state.operationError?.kind !== kind) return;
    state.operationError = null;
    const error = document.getElementById(`operation-error-${kind}`);
    if (error) error.textContent = "";
  }

  function selectRow(index) {
    if (state.mode !== "working") return;

    const existing = state.selection.indexOf(index);
    if (existing !== -1) {
      state.selection.splice(existing, 1);
    } else if (state.selection.length < 2) {
      state.selection.push(index);
    } else {
      state.selection[1] = index;
    }

    resetOperationInputs();

    if (state.selection.length === 1) {
      render({ focusKey: "#scale-factor" });
    } else if (state.selection.length === 2) {
      render({ focusKey: "#add-factor-second" });
    } else {
      render({ focusKey: `row-select-${index}` });
    }
  }

  function moveRow(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= state.size) return;

    const next = swapRows(state.matrix, index, target);
    const nextSelection = state.selection.map((selected) =>
      selected === index ? target : selected === target ? index : selected,
    );
    const focusKey =
      direction < 0
        ? target > 0
          ? `row-up-${target}`
          : `row-down-${target}`
        : target < state.size - 1
          ? `row-down-${target}`
          : `row-up-${target}`;

    state.addFactors = { first: "", second: "" };
    commitOperation(next, formatSwap(index, target), {
      affectedRows: [index, target],
      selection: nextSelection,
      focusKey,
    });
  }

  function moveSelected(direction) {
    if (state.selection.length !== 1) return;

    const index = state.selection[0];
    const target = index + direction;
    if (target < 0 || target >= state.size) return;

    const next = swapRows(state.matrix, index, target);
    state.addFactors = { first: "", second: "" };
    commitOperation(next, formatSwap(index, target), {
      affectedRows: [index, target],
      selection: [target],
      focusKey: `row-select-${target}`,
    });
  }

  function moveSelectedByKeyboard(direction) {
    moveSelected(direction);
  }

  function start() {
    const cellErrors = {};
    const parsed = state.inputValues.map((row, rowIndex) =>
      row.map((raw, columnIndex) => {
        try {
          return Fraction.parse(raw);
        } catch (error) {
          cellErrors[`${rowIndex}:${columnIndex}`] = cellErrorMessage(
            raw,
            error,
          );
          return null;
        }
      }),
    );

    state.cellErrors = cellErrors;

    if (Object.keys(cellErrors).length > 0) {
      render({ restoreFocus: false });
      const firstInvalid = root.querySelector(
        ".matrix-input[aria-invalid='true']",
      );
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    state.mode = "working";
    state.lockedValues = cloneValues(state.inputValues);
    state.matrix = parsed;
    state.history = [];
    state.past = [];
    state.selection = [];
    state.operationError = null;
    state.scaleFactor = "";
    state.addFactors = { first: "", second: "" };
    render({ focusKey: "row-select-0" });
  }

  function changeSize(value) {
    const size = Number(value);
    if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
      return;
    }
    state.size = size;
    state.inputValues = blankValues(size);
    state.lockedValues = null;
    state.cellErrors = {};
    state.selection = [];
    resetOperationInputs();
    render({ focusKey: "#matrix-size" });
  }

  function updateCell(row, column, value) {
    state.inputValues[row][column] = value;
    const key = `${row}:${column}`;
    if (!state.cellErrors[key]) return;

    delete state.cellErrors[key];
    const input = root.querySelector(
      `.matrix-input[data-row="${row}"][data-column="${column}"]`,
    );
    if (!input) return;

    input.setAttribute("aria-invalid", "false");
    const cell = input.closest("td");
    if (cell) cell.classList.remove("cell-invalid");
    const error = cell?.querySelector(".cell-error");
    if (error) error.textContent = "";
  }

  function undo() {
    if (state.past.length === 0) return;

    const focusKey = captureFocusKey();
    const previous = state.past.pop();
    state.matrix = previous.matrix;
    state.selection = [...previous.selection];
    state.history.pop();
    resetOperationInputs();
    render({ focusKey });
  }

  function reset() {
    const focusKey = "#matrix-size";
    state.mode = "input";
    state.inputValues = state.lockedValues
      ? cloneValues(state.lockedValues)
      : blankValues(state.size);
    state.lockedValues = null;
    state.matrix = null;
    state.history = [];
    state.past = [];
    state.cellErrors = {};
    state.selection = [];
    resetOperationInputs();
    render({ focusKey });
  }

  function commitOperation(nextMatrix, label, options = {}) {
    const {
      affectedRows = [],
      selection,
      focusKey = captureFocusKey(),
    } = options;

    state.past.push({
      matrix: state.matrix,
      selection: [...state.selection],
    });
    state.history.push(label);
    state.matrix = nextMatrix;
    if (selection) state.selection = selection;
    state.operationError = null;
    render({ focusKey, flashRows: affectedRows });
  }

  function applyScale() {
    if (state.selection.length !== 1) return;

    const index = state.selection[0];
    let factor;
    try {
      factor = parseOperationFactor(state.scaleFactor, { nonzero: true });
    } catch (error) {
      state.operationError = { kind: "scale", message: error.message };
      render({ focusKey: "#scale-factor" });
      return;
    }

    const next = scaleRow(state.matrix, index, factor);
    commitOperation(next, formatScale(index, factor), {
      affectedRows: [index],
    });
  }

  function applyAddMultiple(kind) {
    if (state.selection.length !== 2) return;

    const [first, second] = state.selection;
    const target = kind === "first" ? first : second;
    const source = kind === "first" ? second : first;

    let factor;
    try {
      factor = parseOperationFactor(state.addFactors[kind]);
    } catch (error) {
      state.operationError = {
        kind: `add-${kind}`,
        message: error.message,
      };
      render({ focusKey: `#add-factor-${kind}` });
      return;
    }

    const next = addRowMultiple(state.matrix, target, source, factor);
    commitOperation(next, formatAddMultiple(target, source, factor), {
      affectedRows: [target],
    });
  }

  function applySwap() {
    if (state.selection.length !== 2) return;

    const [i, j] = state.selection;
    const next = swapRows(state.matrix, i, j);
    const nextSelection = state.selection.map((selected) =>
      selected === i ? j : selected === j ? i : selected,
    );

    state.addFactors = { first: "", second: "" };
    commitOperation(next, formatSwap(i, j), {
      affectedRows: [i, j],
      selection: nextSelection,
    });
  }

  function setScaleFactor(value) {
    state.scaleFactor = value;
    clearOperationError("scale");
  }

  function setAddFactor(kind, value) {
    state.addFactors[kind] = value;
    clearOperationError(`add-${kind}`);
  }

  function setQuickFactor(value) {
    state.scaleFactor = value;
    const input = document.getElementById("scale-factor");
    if (input instanceof HTMLInputElement) {
      input.value = value;
      input.focus({ preventScroll: true });
    }
    clearOperationError("scale");
  }

  function handleKeyDown(event) {
    if (state.mode !== "working") return;

    if (event.key === "Escape") {
      if (document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur();
        event.preventDefault();
        return;
      }

      if (state.selection.length > 0) {
        const focusKey = captureFocusKey();
        state.selection = [];
        resetOperationInputs();
        render({ focusKey });
        event.preventDefault();
      }
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === "u" || event.key === "U") {
      event.preventDefault();
      undo();
      return;
    }

    if (
      (event.key === "ArrowUp" || event.key === "ArrowDown") &&
      state.selection.length === 1
    ) {
      event.preventDefault();
      moveSelectedByKeyboard(event.key === "ArrowUp" ? -1 : 1);
    }
  }

  const actions = {
    start,
    changeSize,
    updateCell,
    undo,
    reset,
    selectRow,
    moveRow,
    applyScale,
    applyAddMultiple,
    applySwap,
    setScaleFactor,
    setAddFactor,
    setQuickFactor,
  };

  document.addEventListener("keydown", handleKeyDown);
  render();
}

function renderHeader(state) {
  return node(
    "header",
    { class: "app-header" },
    node(
      "div",
      { class: "title-block" },
      node("h1", { text: "Gauss Pad" }),
      node("p", {
        class: "subtitle",
        text: "A manual workbench for elementary row operations on augmented matrices.",
      }),
    ),
    node("span", {
      class: `mode-chip mode-chip--${state.mode}`,
      text: state.mode === "input" ? "Input mode" : "Working mode",
    }),
  );
}

function renderMatrixPanel(state, actions) {
  const working = state.mode === "working";
  const actionsArea = working
    ? node(
        "div",
        { class: "matrix-actions" },
        node("span", {
          class: "size-readout",
          text: `n = ${state.size}`,
        }),
        node("button", {
          id: "undo-button",
          class: "button button--secondary",
          type: "button",
          text: "Undo",
          disabled: state.past.length === 0,
          onclick: actions.undo,
        }),
        node("button", {
          id: "reset-button",
          class: "button button--secondary",
          type: "button",
          text: "Reset",
          onclick: actions.reset,
        }),
      )
    : renderInputActions(state, actions);

  return node(
    "section",
    { class: "panel matrix-panel" },
    node(
      "div",
      { class: "panel-heading" },
      node(
        "div",
        {},
        node("h2", { text: "Augmented matrix" }),
        node("p", {
          class: "panel-subtitle",
          text: working
            ? "Read-only. Click a row header to select it; operations apply to the whole row, including the constant column."
            : "The final column holds the constants.",
        }),
      ),
      actionsArea,
    ),
    node(
      "div",
      { class: "matrix-scroll" },
      working ? renderWorkingMatrix(state, actions) : renderInputMatrix(state, actions),
    ),
    node("p", {
      class: "matrix-note",
      text: working
        ? "Selection order defines the direction of two-row operations."
        : "Entries accept integers and exact fractions: 3, -2, 1/2, -3/4. Decimals are rejected.",
    }),
  );
}

function renderInputActions(state, actions) {
  const sizeSelect = node("select", {
    id: "matrix-size",
    "aria-label": "Number of equations and unknowns",
  });

  for (let size = MIN_SIZE; size <= MAX_SIZE; size += 1) {
    sizeSelect.append(
      node("option", { value: String(size), text: String(size) }),
    );
  }
  sizeSelect.value = String(state.size);
  sizeSelect.addEventListener("change", () =>
    actions.changeSize(sizeSelect.value),
  );

  return node(
    "div",
    { class: "matrix-actions" },
    node(
      "label",
      { class: "inline-field", for: "matrix-size" },
      node("span", { text: "Size n" }),
      sizeSelect,
    ),
    node("button", {
      id: "start-button",
      class: "button button--primary",
      type: "button",
      text: "Start",
      onclick: actions.start,
    }),
  );
}

function renderInputMatrix(state, actions) {
  const labels = variableLabels(state.size);
  const headerCells = [
    node("th", { class: "corner", scope: "col" }),
    ...labels.map((label) =>
      node("th", { class: "variable-heading", scope: "col", text: label }),
    ),
    node("th", {
      class: "constant-column constant-heading",
      scope: "col",
      text: "b",
    }),
  ];

  const bodyRows = state.inputValues.map((row, rowIndex) => {
    const cells = row.map((raw, columnIndex) => {
      const key = `${rowIndex}:${columnIndex}`;
      const error = state.cellErrors[key] ?? "";
      const isConstant = columnIndex === state.size;
      const errorId = `cell-error-${rowIndex}-${columnIndex}`;

      const input = node("input", {
        class: "matrix-input",
        type: "text",
        inputmode: "text",
        autocomplete: "off",
        spellcheck: "false",
        value: raw,
        "data-row": String(rowIndex),
        "data-column": String(columnIndex),
        "aria-label": `Row ${rowIndex + 1}, ${
          isConstant ? "constant" : labels[columnIndex]
        }`,
        "aria-invalid": error ? "true" : "false",
        "aria-describedby": errorId,
      });
      input.addEventListener("input", () =>
        actions.updateCell(rowIndex, columnIndex, input.value),
      );

      return node(
        "td",
        {
          class: `matrix-cell${isConstant ? " constant-column" : ""}${
            error ? " cell-invalid" : ""
          }`,
        },
        input,
        node("span", {
          class: "cell-error",
          id: errorId,
          role: "alert",
          text: error,
        }),
      );
    });

    return node(
      "tr",
      { class: "matrix-row" },
      node("th", {
        class: "row-heading",
        scope: "row",
        text: `R${rowIndex + 1}`,
      }),
      ...cells,
    );
  });

  return node(
    "table",
    { class: "matrix-table matrix-table--input" },
    node("caption", { class: "visually-hidden", text: "Editable augmented matrix" }),
    node("thead", {}, node("tr", {}, ...headerCells)),
    node("tbody", {}, ...bodyRows),
  );
}

function renderWorkingMatrix(state, actions) {
  const labels = variableLabels(state.size);
  const headerCells = [
    node("th", { class: "corner", scope: "col" }),
    ...labels.map((label) =>
      node("th", { class: "variable-heading", scope: "col", text: label }),
    ),
    node("th", {
      class: "constant-column constant-heading",
      scope: "col",
      text: "b",
    }),
  ];

  const bodyRows = state.matrix.map((row, rowIndex) => {
    const selected = state.selection.includes(rowIndex);
    const cells = row.map((entry, columnIndex) =>
      node(
        "td",
        {
          class: `matrix-cell${columnIndex === state.size ? " constant-column" : ""}`,
        },
        node("span", {
          class: "matrix-entry",
          text: entry.toString(),
        }),
      ),
    );

    const rowHeader = node(
      "th",
      {
        class: "row-heading row-heading--interactive",
        scope: "row",
      },
      node(
        "div",
        { class: "row-heading-stack" },
        node("button", {
          class: `row-select${selected ? " row-select--selected" : ""}`,
          type: "button",
          "aria-pressed": selected ? "true" : "false",
          "aria-label": `Select row ${rowIndex + 1}`,
          "data-focus-key": `row-select-${rowIndex}`,
          text: `R${rowIndex + 1}`,
          onclick: () => actions.selectRow(rowIndex),
        }),
        node(
          "div",
          { class: "row-move-buttons" },
          node("button", {
            class: "row-move-button",
            type: "button",
            text: "↑",
            "aria-label": `Move row ${rowIndex + 1} up`,
            "data-focus-key": `row-up-${rowIndex}`,
            disabled: rowIndex === 0,
            onclick: () => actions.moveRow(rowIndex, -1),
          }),
          node("button", {
            class: "row-move-button",
            type: "button",
            text: "↓",
            "aria-label": `Move row ${rowIndex + 1} down`,
            "data-focus-key": `row-down-${rowIndex}`,
            disabled: rowIndex === state.size - 1,
            onclick: () => actions.moveRow(rowIndex, 1),
          }),
        ),
      ),
    );

    return node(
      "tr",
      {
        class: `matrix-row${selected ? " matrix-row--selected" : ""}`,
        "data-row": String(rowIndex),
      },
      rowHeader,
      ...cells,
    );
  });

  return node(
    "table",
    { class: "matrix-table matrix-table--working" },
    node("caption", { class: "visually-hidden", text: "Current augmented matrix" }),
    node("thead", {}, node("tr", {}, ...headerCells)),
    node("tbody", {}, ...bodyRows),
  );
}

function renderStatusPanel(state) {
  if (state.mode === "input") {
    return node(
      "section",
      { class: "panel status-panel status-panel--input", "aria-live": "polite" },
      node("h2", { text: "Status" }),
      node("p", { class: "status-title", text: "Input mode" }),
      node("p", {
        class: "status-detail",
        text: "The matrix is editable. Press Start to lock the entries and begin.",
      }),
    );
  }

  const status = classify(state.matrix);
  const labels = variableLabels(state.size);
  const constants = state.matrix.map((row) => row[state.size].toString());
  const details = [];

  if (status === "solved") {
    details.push(
      node("p", { class: "status-title", text: "Solved" }),
      node("p", {
        class: "status-detail",
        text: "The coefficient part is the identity matrix.",
      }),
      node("p", {
        class: "solution-assignments",
        text: labels
          .map((label, index) => `${label} = ${constants[index]}`)
          .join(", "),
      }),
      node("p", {
        class: "solution-vector",
        text: `Solution vector: (${constants.join(", ")})`,
      }),
    );
  } else if (status === "inconsistent") {
    details.push(
      node("p", {
        class: "status-title",
        text: "Inconsistent: no solution.",
      }),
      node("p", {
        class: "status-detail",
        text: "A row has zero coefficients and a nonzero constant.",
      }),
    );
  } else if (status === "singular") {
    details.push(
      node("p", { class: "status-title", text: "Singular" }),
      node("p", {
        class: "status-detail",
        text: "The coefficient matrix is singular, so this system does not have a unique solution.",
      }),
    );
  } else {
    details.push(
      node("p", { class: "status-title", text: "In progress" }),
      node("p", {
        class: "status-detail",
        text: "The coefficient part is not the identity matrix.",
      }),
    );
  }

  return node(
    "section",
    {
      class: `panel status-panel status-panel--${status}`,
      "aria-live": "polite",
    },
    node("h2", { text: "Status" }),
    ...details,
  );
}

function renderOperationBar(state, actions) {
  if (state.mode === "input") {
    return node(
      "section",
      {
        class: "panel operation-bar operation-bar--input",
        "aria-live": "polite",
      },
      node("p", {
        class: "operation-hint",
        text: "Enter the augmented matrix, then press Start to enable row selection.",
      }),
    );
  }

  if (state.selection.length === 0) {
    return node(
      "section",
      { class: "panel operation-bar", "aria-live": "polite" },
      node("p", {
        class: "operation-hint",
        text: "Click a row to begin. Click a second row to combine rows.",
      }),
    );
  }

  if (state.selection.length === 1) {
    return renderScaleBar(state, actions);
  }

  return renderTwoRowBar(state, actions);
}

function renderScaleBar(state, actions) {
  const index = state.selection[0];
  const rowLabel = `R${index + 1}`;
  const error =
    state.operationError?.kind === "scale"
      ? state.operationError.message
      : "";

  const factor = node("input", {
    id: "scale-factor",
    class: "factor-input",
    type: "text",
    inputmode: "text",
    autocomplete: "off",
    spellcheck: "false",
    value: state.scaleFactor,
    placeholder: "factor",
    "aria-label": `Scale factor for row ${index + 1}`,
  });
  factor.addEventListener("input", () =>
    actions.setScaleFactor(factor.value),
  );

  const quickButtons = QUICK_FACTORS.map((value) =>
    node("button", {
      class: "quick-factor",
      type: "button",
      text: value,
      "aria-label": `Use factor ${value}`,
      onclick: () => actions.setQuickFactor(value),
    }),
  );

  const form = node(
    "form",
    { class: "scale-form", novalidate: true },
    node(
      "label",
      { class: "operation-label", for: "scale-factor" },
      "Scale ",
      node("strong", { text: rowLabel }),
      " by",
    ),
    factor,
    node(
      "div",
      {
        class: "quick-factors",
        role: "group",
        "aria-label": "Quick factors",
      },
      ...quickButtons,
    ),
    node("button", {
      id: "scale-apply",
      class: "button button--primary",
      type: "submit",
      text: "Scale",
    }),
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.applyScale();
  });

  return node(
    "section",
    { class: "panel operation-bar" },
    node("div", { class: "operation-line" }, form),
    node("p", {
      class: "op-error",
      id: "operation-error-scale",
      role: "alert",
      text: error,
    }),
  );
}

function renderTwoRowBar(state, actions) {
  const [first, second] = state.selection;
  const firstLabel = `R${first + 1}`;
  const secondLabel = `R${second + 1}`;

  return node(
    "section",
    { class: "panel operation-bar operation-bar--two" },
    node(
      "p",
      { class: "selection-summary" },
      "Selected in order: ",
      node("strong", { text: firstLabel }),
      " then ",
      node("strong", { text: secondLabel }),
    ),
    node(
      "div",
      { class: "two-row-operations" },
      node(
        "div",
        { class: "swap-action" },
        node("button", {
          id: "swap-apply",
          class: "button button--secondary",
          type: "button",
          text: `Swap ${firstLabel} <-> ${secondLabel}`,
          onclick: actions.applySwap,
        }),
      ),
      renderAddForm(
        "first",
        first,
        second,
        firstLabel,
        secondLabel,
        state,
        actions,
      ),
      renderAddForm(
        "second",
        second,
        first,
        secondLabel,
        firstLabel,
        state,
        actions,
      ),
    ),
  );
}

function renderAddForm(
  kind,
  target,
  source,
  targetLabel,
  sourceLabel,
  state,
  actions,
) {
  const errorKind = `add-${kind}`;
  const error =
    state.operationError?.kind === errorKind
      ? state.operationError.message
      : "";
  const factor = node("input", {
    id: `add-factor-${kind}`,
    class: "factor-input",
    type: "text",
    inputmode: "text",
    autocomplete: "off",
    spellcheck: "false",
    value: state.addFactors[kind],
    placeholder: "factor",
    "aria-label": `Factor for ${targetLabel} <- ${targetLabel} + c*${sourceLabel}`,
  });
  factor.addEventListener("input", () =>
    actions.setAddFactor(kind, factor.value),
  );

  const form = node(
    "form",
    { class: "add-form", novalidate: true },
    node(
      "label",
      {
        class: "add-direction",
        for: `add-factor-${kind}`,
      },
      node("span", {
        class: "mono",
        text: `${targetLabel} <- ${targetLabel} + c*${sourceLabel}`,
      }),
    ),
    node(
      "div",
      { class: "add-controls" },
      factor,
      node("button", {
        id: `add-apply-${kind}`,
        class: "button button--primary",
        type: "submit",
        text: "Apply",
      }),
    ),
    node("p", {
      class: "op-error",
      id: `operation-error-${errorKind}`,
      role: "alert",
      text: error,
    }),
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.applyAddMultiple(kind);
  });

  return form;
}

function renderHistoryPanel(state) {
  const history =
    state.history.length === 0
      ? node("p", {
          class: "empty-state",
          text: "No elementary row operations performed.",
        })
      : node(
          "ol",
          { class: "history-list" },
          ...state.history.map((entry) =>
            node("li", { text: entry }),
          ),
        );

  return node(
    "section",
    { class: "panel history-panel" },
    node("h2", { text: "History" }),
    node("p", { class: "panel-subtitle", text: "Newest at the bottom." }),
    history,
  );
}

function renderLegendPanel() {
  return node(
    "section",
    { class: "panel legend-panel" },
    node("h2", { text: "Legend" }),
    node(
      "ul",
      { class: "legend-list" },
      node(
        "li",
        {},
        node("strong", { text: "Swap" }),
        " — interchange two rows: Ri <-> Rj.",
      ),
      node(
        "li",
        {},
        node("strong", { text: "Scale" }),
        " — multiply one row by a nonzero factor: Ri <- c*Ri, c != 0.",
      ),
      node(
        "li",
        {},
        node("strong", { text: "Add multiple" }),
        " — add a multiple of one row to another: Ri <- Ri + c*Rj, i != j.",
      ),
    ),
    node("p", {
      class: "terminology",
      text: "The coefficient part is the square block left of the separator; the final column holds the constants. A pivot is a leading nonzero entry used during elimination. An identity coefficient part is the reduced row echelon form of the augmented matrix.",
    }),
  );
}
