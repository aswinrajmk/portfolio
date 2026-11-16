// Creates .dev.vars (gitignored) with a random local-only RESULTS_API_TOKEN if it does not exist yet.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const file = ".dev.vars";
const current = existsSync(file) ? readFileSync(file, "utf8") : "";
if (!/^RESULTS_API_TOKEN=/m.test(current)) {
  const line = `RESULTS_API_TOKEN=${randomBytes(16).toString("hex")}\n`;
  writeFileSync(file, current + (current && !current.endsWith("\n") ? "\n" : "") + line);
  console.log("Created a local RESULTS_API_TOKEN in .dev.vars");
}
