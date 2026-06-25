/**
 * Conformance-test harness (road-to-actually-works P1, Overview §4.1).
 *
 * The single rule that would have caught "green in tests, dead on screen": for
 * every fake the UI/sidecar was built against, ONE test runs the REAL
 * implementation and asserts the fake still matches its SHAPE. The fast CI lane
 * runs the always-on shape-stability checks; the real leg (spawning the actual
 * `claude` / `docker` / PTY) is opt-in via env so it runs in the nightly
 * real-dependency lane without throttling PR velocity.
 *
 * "Shape" = structural skeleton (keys + value types, recursively) — NOT values.
 * A fake conforms when its shape is a subset of the real shape (the real may
 * carry extra fields; the fake must not invent fields the real lacks).
 */

/** A structural skeleton: primitives → their typeof; arrays → element-union; objects → per-key shapes. */
export type Shape =
  | { kind: "primitive"; type: string }
  | { kind: "array"; element: Shape }
  | { kind: "object"; keys: Record<string, Shape> }
  | { kind: "empty-array" }
  | { kind: "null" };

export function shapeOf(value: unknown): Shape {
  if (value === null) return { kind: "null" };
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: "empty-array" };
    return { kind: "array", element: mergeShapes(value.map(shapeOf)) };
  }
  if (typeof value === "object") {
    const keys: Record<string, Shape> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      keys[k] = shapeOf(v);
    }
    return { kind: "object", keys };
  }
  return { kind: "primitive", type: typeof value };
}

/** Merge sibling shapes (array elements) — keys union; differing primitives widen to "mixed". */
function mergeShapes(shapes: Shape[]): Shape {
  return shapes.reduce((a, b) => (shapesCompatible(a, b) ? widen(a, b) : { kind: "primitive", type: "mixed" }));
}

function widen(a: Shape, b: Shape): Shape {
  if (a.kind === "object" && b.kind === "object") {
    const keys = { ...a.keys };
    for (const [k, s] of Object.entries(b.keys)) keys[k] = keys[k] ? widen(keys[k], s) : s;
    return { kind: "object", keys };
  }
  return a;
}

function shapesCompatible(a: Shape, b: Shape): boolean {
  if (a.kind === "null" || b.kind === "null") return true;
  if (a.kind === "empty-array" || b.kind === "empty-array") return true;
  return a.kind === b.kind;
}

/**
 * Assert `fake` is shape-compatible with `real`: every key the fake declares
 * must exist in real with a compatible type. Returns a list of mismatches
 * (empty = conforms). Real may carry extra keys — that is forward-compatible.
 */
export function shapeMismatches(fake: Shape, real: Shape, path = "$"): string[] {
  const out: string[] = [];
  if (fake.kind === "null" || real.kind === "null") return out;
  if (fake.kind === "empty-array" || real.kind === "empty-array") return out;
  if (fake.kind !== real.kind) {
    out.push(`${path}: fake is ${fake.kind}, real is ${real.kind}`);
    return out;
  }
  if (fake.kind === "primitive" && real.kind === "primitive") {
    if (fake.type !== real.type && real.type !== "mixed" && fake.type !== "mixed") {
      out.push(`${path}: fake type ${fake.type} ≠ real type ${real.type}`);
    }
  } else if (fake.kind === "array" && real.kind === "array") {
    out.push(...shapeMismatches(fake.element, real.element, `${path}[]`));
  } else if (fake.kind === "object" && real.kind === "object") {
    for (const [k, s] of Object.entries(fake.keys)) {
      const r = real.keys[k];
      if (!r) out.push(`${path}.${k}: present in fake, MISSING in real (invented field?)`);
      else out.push(...shapeMismatches(s, r, `${path}.${k}`));
    }
  }
  return out;
}

/** True when the real dependency leg should run (opt-in for the nightly lane). */
export function realLegEnabled(): boolean {
  return process.env.CAPISCO_CONFORMANCE_REAL === "1";
}
