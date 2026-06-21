import { DiffView } from "./DiffView";
import { mockDiff } from "@/mocks";

/** The recycled diff primitive (build-spec §2) in its default split layout. */
export const Split = () => (
  <div className="h-[520px] w-full overflow-hidden rounded border border-border">
    <DiffView doc={mockDiff} />
  </div>
);

/** A short diff to show the added/removed/context line styling clearly. */
export const ShortDiff = () => (
  <div className="h-[320px] w-full overflow-hidden rounded border border-border">
    <DiffView
      doc={{
        file: "src/core/broker.ts",
        ext: "ts",
        added: 2,
        removed: 1,
        rows: [
          { l: { n: 1, t: "export class Broker {" }, r: { n: 1, t: "export class Broker {" }, k: "ctx" },
          { l: { n: 2, t: "  grant() {}" }, r: null, k: "del" },
          { l: null, r: { n: 2, t: "  grant(scope: Scope) {" }, k: "add" },
          { l: null, r: { n: 3, t: "    return this.scopes.add(scope);" }, k: "add" },
          { l: { n: 3, t: "}" }, r: { n: 4, t: "  }" }, k: "ctx" },
        ],
      }}
    />
  </div>
);
