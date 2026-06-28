import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/payments")({
  component: () => <ComingSoon title="Payments" description="Record payments received from customers." />,
});