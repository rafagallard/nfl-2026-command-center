import { readdir, readFile } from "node:fs/promises";

/**
 * Stops a deployment when the compiled bundle does not contain the rebuilt
 * position cards or accidentally reintroduces the obsolete combined O-line.
 */
const assetNames = await readdir("dist/assets");
const javascriptNames = assetNames.filter((name) => name.endsWith(".js"));
const stylesheetNames = assetNames.filter((name) => name.endsWith(".css"));

if (!javascriptNames.length || !stylesheetNames.length) {
  throw new Error("The production build did not generate JavaScript and CSS assets.");
}

const javascript = (await Promise.all(javascriptNames.map((name) => readFile(`dist/assets/${name}`, "utf8")))).join("\n");
const stylesheet = (await Promise.all(stylesheetNames.map((name) => readFile(`dist/assets/${name}`, "utf8")))).join("\n");

const validations = [
  [javascript.includes("position-card"), "The position card component is missing from the JavaScript bundle."],
  [javascript.includes("Equipos especiales"), "The special-teams position group is missing from the JavaScript bundle."],
  [!javascript.includes("LT/LG/C/RG/RT"), "The obsolete combined offensive-line row is still present."],
  [stylesheet.includes(".position-card-grid"), "The responsive position-card grid is missing from the stylesheet."],
  [stylesheet.includes("text-size-adjust"), "Mobile text-size protection is missing from the stylesheet."],
];

for (const [passed, message] of validations) {
  if (!passed) throw new Error(message);
}

console.log(JSON.stringify({ ok: true, javascriptNames, stylesheetNames }, null, 2));
