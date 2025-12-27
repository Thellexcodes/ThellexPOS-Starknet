/**
 * src/dump.ts
 * ----------
 * Lightweight, readable console dump utility for debugging.
 *
 * Usage:
 *   dump(value)
 *   dump("label", value)
 */

export function dump(value: unknown): void;
export function dump(key: string, value: unknown): void;

export function dump(arg1: unknown, arg2?: unknown): void {
  const hasKey = typeof arg1 === "string" && arguments.length === 2;

  const label = hasKey ? (arg1 as string) : "dump";
  const value = hasKey ? arg2 : arg1;

  const timestamp = new Date().toISOString();

  console.log("\n────────────────────────────────────────");
  console.log(`📦 ${label}`);
  console.log(`🕒 ${timestamp}`);
  console.log("────────────────────────────────────────");

  if (typeof value === "object" && value !== null) {
    console.dir(value, { depth: null, colors: true });
  } else {
    console.log(value);
  }

  console.log("────────────────────────────────────────\n");
}
