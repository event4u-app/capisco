import { Check } from "lucide-react";

function Field({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="cursor-default px-1.5 text-muted-foreground hover:text-foreground"
    >
      {children}
    </span>
  );
}

export function StatusBar() {
  return (
    <footer
      data-testid="status-bar"
      className="flex h-[26px] items-center bg-card text-micro text-muted-foreground"
    >
      <span className="px-2 font-mono">capisco › src › core › broker.ts</span>
      <div className="flex-1" />
      <Field>TypeScript 6.0</Field>
      <Field title="branch · sync">⎇ main ↑2</Field>
      <Field title="blame">matze, 2d ago</Field>
      <Field>Ln 24, Col 8</Field>
      <Field title="line endings">LF</Field>
      <Field>UTF-8</Field>
      <span className="flex items-center gap-1 px-2 text-primary">
        <Check className="size-3" strokeWidth={2} />
        capisco
      </span>
    </footer>
  );
}
