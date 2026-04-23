import { readFile } from "node:fs/promises";

export async function getPackageVersion(): Promise<string> {
  const pkgPath = new URL("../package.json", import.meta.url);
  const raw = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.0.0";
}

