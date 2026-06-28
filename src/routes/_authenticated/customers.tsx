import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/customers")({
  component: () => <ComingSoon title="Customers" description="Manage your customers, balances, and statements." />,
});