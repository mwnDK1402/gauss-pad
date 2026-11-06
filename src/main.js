import { mountApp } from "./ui.js";
import { runSelfTest } from "./selftest.js";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root element.");
}

if (new URLSearchParams(window.location.search).has("test")) {
  runSelfTest(root);
} else {
  mountApp(root);
}
