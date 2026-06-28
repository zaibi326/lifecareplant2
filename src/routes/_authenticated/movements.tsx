import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/movements")({
  validateSearch: (s: Record<string, unknown>) => ({ type: (s.type as "receive" | "deliver") ?? "receive" }),
  component: () => <ComingSoon title="Cylinder Movements" description="Receive cylinders from customers or deliver filled cylinders." />,
});