import { mkdir, writeFile } from "node:fs/promises";

/**
 * Writes release metadata into the compiled artifact so an administrator can
 * compare the public site with the commit selected by GitHub Actions.
 */
const buildInfo = {
  sha: process.env.VITE_BUILD_SHA || "local",
  builtAt: new Date().toISOString(),
};

await mkdir("dist", { recursive: true });
await writeFile("dist/build-info.json", `${JSON.stringify(buildInfo, null, 2)}\n`, "utf8");
