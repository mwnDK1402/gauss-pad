import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

const result = await esbuild.build({
  entryPoints: [path.join(root, "src/main.js")],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: false,
  write: false,
});

const bundleFile =
  result.outputFiles.find((file) => file.path.endsWith(".js")) ??
  result.outputFiles[0];
if (!bundleFile) {
  throw new Error("esbuild did not produce a JavaScript bundle.");
}

const css = await readFile(path.join(root, "src/style.css"), "utf8");
const template = await readFile(path.join(root, "template.html"), "utf8");

if (!template.includes("<!--STYLES-->") || !template.includes("<!--BUNDLE-->")) {
  throw new Error("template.html is missing the STYLES or BUNDLE placeholder.");
}

const escapedBundle = bundleFile.text.split("</script>").join("<\\/script>");
const html = template
  .split("<!--STYLES-->")
  .join(css)
  .split("<!--BUNDLE-->")
  .join(escapedBundle);

await mkdir(path.join(root, "dist"), { recursive: true });
const outputPath = path.join(root, "dist/index.html");
await writeFile(outputPath, html);

const bytes = Buffer.byteLength(html);
console.log(`Built ${path.relative(process.cwd(), outputPath)} (${bytes} bytes)`);
