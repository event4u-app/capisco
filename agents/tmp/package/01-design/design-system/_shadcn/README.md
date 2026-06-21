# Capisco × shadcn/ui — production component source

Real **shadcn/ui** source (Radix UI + Tailwind + `cva`) for the Capisco Vite/Next
frontend. The components follow shadcn conventions exactly, but every token resolves to
the **Capisco JetBrains-dark palette** via `app/globals.css` — so you get shadcn's API and
ergonomics with Capisco's look, dark by default.

> This folder is the production handoff. The in-browser design-system kit
> (`../ui_kits/capisco-ide/`) demonstrates the same UI; this is the code your real app ships.
>
> **The leading underscore** (`_shadcn/`) only keeps this TypeScript source out of the
> in-browser DS component bundler. When you copy it into your repo, drop the underscore
> (`shadcn/` or wherever your `components/` lives).

## What's here

```
_shadcn/
├── components.json            # shadcn CLI config (new-york, lucide, cssVariables)
├── tailwind.config.ts         # theme → CSS vars; Inter + JetBrains Mono; dense sizes
├── app/globals.css            # shadcn tokens, Capisco values (.dark = canonical)
├── lib/utils.ts               # cn()
└── components/
    ├── ui/                    # generic shadcn primitives
    │   ├── button.tsx  input.tsx  badge.tsx  card.tsx
    │   ├── tabs.tsx    tooltip.tsx  dropdown-menu.tsx
    └── capisco/               # Capisco-specific, built on the primitives
        ├── status-dot.tsx     # running / idle / waiting (broker) / error
        ├── model-badge.tsx    # Claude / GPT-5 / Local
        └── permission-prompt.tsx  # the capability-broker approval block
```

## Setup in a Vite/Next app

1. **Install deps**
   ```bash
   npm i tailwindcss tailwindcss-animate class-variance-authority clsx tailwind-merge \
         @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-tooltip \
         @radix-ui/react-dropdown-menu lucide-react
   ```
2. **Copy** `tailwind.config.ts`, `app/globals.css`, `lib/`, and `components/` into your repo
   (paths assume the `@/` alias → project root; adjust `tsconfig` `paths` or `components.json`).
3. **Import the CSS** once (e.g. `app/layout.tsx` or `main.tsx`): `import "@/app/globals.css"`.
4. **Default to dark** — Capisco is dark-canonical. Put `class="dark"` on `<html>` (or use
   `next-themes` with `defaultTheme="dark"`). The light theme is the `:root` block.
5. **Add more primitives** with the CLI — they'll inherit these tokens automatically:
   ```bash
   npx shadcn@latest add dialog sheet command popover
   ```

## Theming

All color comes from CSS variables in `app/globals.css` as HSL triplets, consumed via
`hsl(var(--x))` in `tailwind.config.ts`. To retune the brand, edit the variables — never
hard-code hex in components. Key mappings:

| shadcn token | Capisco role | dark value |
|---|---|---|
| `--background` | editor surface | `#1E1F22` |
| `--card` / `--popover` | tool window | `#2B2D30` |
| `--muted` | sunken input / terminal | `#1C1D20` |
| `--primary` | teal accent (use sparingly) | `#3FB6A8` |
| `--accent` | hover wash | `#34373B` |
| `--border` / `--input` | 1px separators | `#393B40` |
| `--ring` | focus | teal |
| `--radius` | near-square chrome | `0.25rem` |

Semantic extras (`--success`, `--warning`, `--destructive`, `--git-*`) match the kit's diff
and status colors.

## Usage

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/capisco/status-dot";
import { PermissionPrompt } from "@/components/capisco/permission-prompt";

<Button variant="default">Allow once</Button>      {/* teal — the one emphasized action */}
<Button variant="outline">This session</Button>
<Button variant="ghost">Deny</Button>

<StatusDot status="running" />
<Badge variant="accent">Local</Badge>

<PermissionPrompt
  command="Bash(rm -rf .worktrees/tmp)"
  onGrant={(scope) => grant(scope)}
/>
```

### Conventions kept from shadcn
- `cva` variants + `cn()` merge; `asChild` via Radix `Slot` (Button).
- Components are **copy-in source you own** — edit freely.
- `forwardRef`, `data-[state=…]` styling, Radix portals for overlays.

### Capisco house rules (carried over)
- **Density:** controls are 24–28px (`size="sm"` default), text 11–14px chrome / 13px code.
- **Teal is rationed** — `variant="default"`/`"accent"` only for the single important action.
- Surfaces separate by brightness, not heavy borders or shadow (only popovers cast one).
