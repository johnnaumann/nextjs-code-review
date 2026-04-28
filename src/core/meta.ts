declare const __PKG_VERSION__: string | undefined;

export function getPackageVersion(): string {
  if (typeof __PKG_VERSION__ === "string" && __PKG_VERSION__.length > 0) {
    return __PKG_VERSION__;
  }
  return "0.0.0";
}
