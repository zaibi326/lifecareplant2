import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/stock")({
  component: () => <ComingSoon title="Plant Stock" description="Gas-wise plant stock, customer stock and totals." />,
});