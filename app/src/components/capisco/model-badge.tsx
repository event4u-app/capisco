import * as React from "react";

import { Badge } from "@/components/ui/badge";

/**
 * Capisco ModelBadge — names the model behind an agent session.
 * Thin wrapper over <Badge>; keep `outline` (default) almost everywhere,
 * `accent` only to spotlight the focused session.
 */
export function ModelBadge({
  children,
  spotlight = false,
}: {
  children: React.ReactNode;
  spotlight?: boolean;
}) {
  return <Badge variant={spotlight ? "accent" : "outline"}>{children}</Badge>;
}
