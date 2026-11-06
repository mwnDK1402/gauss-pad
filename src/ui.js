import { Fraction, ONE } from "./fraction.js";
import { addRowMultiple, scaleRow, swapRows } from "./matrix.js";
import { classify } from "./status.js";

const VARIABLES = ["x", "y", "z", "w", "u", "v"];
const MIN_SIZE = 2;
const MAX_SIZE = 6;
const DEFAULT_SIZE = 3;
const NEGATIVE_ONE = new Fraction(-1n);

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

function defaultOperationInputs(size) {
  const second = size > 1 ? 1 : 0;
  return {
    swap: { i: 0, j: second },
    scale: { i: 0, factor: "" },
    add: { target: 0, source: second, factor: "" },
  };
}

function emptyOperationErrors() {
  return { swap: "", scale: "", add: "" };
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
    operationErrors: emptyOperationErrors(),
    operationInputs: defaultOperationInputs(DEFAULT_SIZE),
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

  function render() {
    const app = node(
      "div",
      { class: "app-shell" },
      renderHeader(state),
      node(
        "main",
        { class: "workspace" },
        renderMatrixPanel(state, actions),
        node(
          "aside",
          { class: "sidebar" },
          renderStatusPanel(state),
          state.mode === "working"
            ? renderOperationsPanel(state, actions)
            : renderInputNotePanel(),
          renderHistoryPanel(state),
          renderLegendPanel(),
        ),
      ),
      node(
        "footer",
        { class: "app-footer" },
        "Exact rational arithmetic. Every row operation is applied only when you submit it.",
      ),
    );

    root.replaceChildren(app);

    const historyList = root.querySelector(".history-list");
    if (historyList) {
      historyList.scrollTop = historyList.scrollHeight;
    }
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
      render();
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
    state.operationErrors = emptyOperationErrors();
    state.operationInputs = defaultOperationInputs(state.size);
    render();
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
    state.operationInputs = defaultOperationInputs(size);
    render();
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
    state.matrix = state.past.pop();
    state.history.pop();
    state.operationErrors = emptyOperationErrors();
    render();
  }

  function reset() {
    state.mode = "input";
    state.inputValues = state.lockedValues
      ? cloneValues(state.lockedValues)
      : blankValues(state.size);
    state.lockedValues = null;
    state.matrix = null;
    state.history = [];
    state.past = [];
    state.cellErrors = {};
    state.operationErrors = emptyOperationErrors();
    state.operationInputs = defaultOperationInputs(state.size);
    render();
  }

  function commitOperation(nextMatrix, label) {
    state.past.push(state.matrix);
    state.history.push(label);
    state.matrix = nextMatrix;
    state.operationErrors = emptyOperationErrors();
    render();
  }

  function applySwap() {
    const { i, j } = state.operationInputs.swap;
    const next = swapRows(state.matrix, i, j);
    commitOperation(next, formatSwap(i, j));
  }

  function applyScale() {
    let factor;
    try {
      factor = parseOperationFactor(state.operationInputs.scale.factor, {
        nonzero: true,
      });
    } catch (error) {
      state.operationErrors.scale = error.message;
      render();
      document.getElementById("scale-factor")?.focus();
      return;
    }

    const { i } = state.operationInputs.scale;
    const next = scaleRow(state.matrix, i, factor);
    commitOperation(next, formatScale(i, factor));
  }

  function applyAddMultiple() {
    const { target, source } = state.operationInputs.add;

    if (target === source) {
      state.operationErrors.add =
        "Choose different target and source rows.";
      render();
      document.getElementById("add-source-row")?.focus();
      return;
    }

    let factor;
    try {
      factor = parseOperationFactor(state.operationInputs.add.factor);
    } catch (error) {
      state.operationErrors.add = error.message;
      render();
      document.getElementById("add-factor")?.focus();
      return;
    }

    const next = addRowMultiple(state.matrix, target, source, factor);
    commitOperation(next, formatAddMultiple(target, source, factor));
  }

  const actions = {
    start,
    changeSize,
    updateCell,
    undo,
    reset,
    applySwap,
    applyScale,
    applyAddMultiple,
  };

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
          class: "button button--secondary",
          type: "button",
          text: "Undo",
          disabled: state.past.length === 0,
          onclick: actions.undo,
        }),
        node("button", {
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
            ? "Read-only. The matrix changes only through the operations you submit."
            : "The final column holds the constants.",
        }),
      ),
      actionsArea,
    ),
    node(
      "div",
      { class: "matrix-scroll" },
      working
        ? renderWorkingMatrix(state)
        : renderInputMatrix(state, actions),
    ),
    node("p", {
      class: "matrix-note",
      text: working
        ? "Every operation applies to the whole row, including the constant column."
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
      {},
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

function renderWorkingMatrix(state) {
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

    return node(
      "tr",
      {},
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

function renderOperationsPanel(state, actions) {
  const size = state.size;

  return node(
    "section",
    { class: "panel operations-panel" },
    node("h2", { text: "Elementary row operations" }),
    node("p", {
      class: "panel-subtitle",
      text: "Apply one operation at a time. The app performs exactly the operation you submit.",
    }),
    node(
      "div",
      { class: "operation-list" },
      renderSwapOperation(state, actions, size),
      renderScaleOperation(state, actions, size),
      renderAddOperation(state, actions, size),
    ),
  );
}

function rowSelect(id, value, size, onChange) {
  const select = node("select", { id });
  for (let index = 0; index < size; index += 1) {
    select.append(
      node("option", { value: String(index), text: `R${index + 1}` }),
    );
  }
  select.value = String(value);
  select.addEventListener("change", () => onChange(Number(select.value)));
  return select;
}

function factorInput(id, value, placeholder, onInput) {
  const input = node("input", {
    id,
    type: "text",
    inputmode: "text",
    autocomplete: "off",
    spellcheck: "false",
    value,
    placeholder,
  });
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function field(labelText, control) {
  return node(
    "div",
    { class: "field" },
    node("label", { for: control.id, text: labelText }),
    control,
  );
}

function operationForm({
  title,
  description,
  fields,
  buttonLabel,
  error,
  onSubmit,
}) {
  const form = node(
    "form",
    { class: "operation-card", novalidate: true },
    node("h3", { text: title }),
    node("p", { class: "operation-description", text: description }),
    node("div", { class: "operation-fields" }, ...fields),
    node("p", { class: "op-error", role: "alert", text: error }),
    node("button", {
      class: "button button--primary button--full",
      type: "submit",
      text: buttonLabel,
    }),
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit();
  });

  return form;
}

function renderSwapOperation(state, actions, size) {
  const input = state.operationInputs.swap;

  return operationForm({
    title: "Swap rows",
    description: "Interchange two rows.",
    fields: [
      field(
        "Row i",
        rowSelect("swap-row-i", input.i, size, (value) => {
          input.i = value;
        }),
      ),
      field(
        "Row j",
        rowSelect("swap-row-j", input.j, size, (value) => {
          input.j = value;
        }),
      ),
    ],
    buttonLabel: "Swap rows",
    error: state.operationErrors.swap,
    onSubmit: actions.applySwap,
  });
}

function renderScaleOperation(state, actions, size) {
  const input = state.operationInputs.scale;

  return operationForm({
    title: "Scale a row",
    description: "Multiply one row by a nonzero factor.",
    fields: [
      field(
        "Row i",
        rowSelect("scale-row-i", input.i, size, (value) => {
          input.i = value;
        }),
      ),
      field(
        "Factor c",
        factorInput("scale-factor", input.factor, "e.g. 1/2", (value) => {
          input.factor = value;
        }),
      ),
    ],
    buttonLabel: "Scale row",
    error: state.operationErrors.scale,
    onSubmit: actions.applyScale,
  });
}

function renderAddOperation(state, actions, size) {
  const input = state.operationInputs.add;

  return operationForm({
    title: "Add a row multiple",
    description: "Add a multiple of a source row to a target row.",
    fields: [
      field(
        "Target row i",
        rowSelect("add-target-row", input.target, size, (value) => {
          input.target = value;
        }),
      ),
      field(
        "Source row j",
        rowSelect("add-source-row", input.source, size, (value) => {
          input.source = value;
        }),
      ),
      field(
        "Factor c",
        factorInput("add-factor", input.factor, "e.g. -2", (value) => {
          input.factor = value;
        }),
      ),
    ],
    buttonLabel: "Add multiple",
    error: state.operationErrors.add,
    onSubmit: actions.applyAddMultiple,
  });
}

function renderInputNotePanel() {
  return node(
    "section",
    { class: "panel input-note-panel" },
    node("h2", { text: "Before you start" }),
    node("p", {
      text: "Choose n, enter the augmented matrix, and press Start. Working mode then exposes the three elementary row operations.",
    }),
  );
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
      text: "The coefficient part is the square block left of the separator; the final column holds the constants. A pivot is a leading nonzero entry used during elimination.",
    }),
  );
}
