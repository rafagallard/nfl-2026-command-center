import { readFile } from "node:fs/promises";

/**
 * Ensures Vite starts from the React source instead of accidentally rebuilding
 * a previously generated JavaScript bundle committed at the repository root.
 */
const sourceIndex = await readFile("index.html", "utf8");

if (!sourceIndex.includes('src="/src/main.tsx"')) {
  throw new Error("index.html must load /src/main.tsx before a production build.");
}

if (sourceIndex.includes("./assets/index-")) {
  throw new Error("index.html points to an obsolete compiled asset.");
}

console.log(JSON.stringify({ ok: true, entry: "/src/main.tsx" }, null, 2));
