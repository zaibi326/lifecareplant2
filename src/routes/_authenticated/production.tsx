import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/production")({
  component: () => <ComingSoon title="Filling Production" description="Daily filling production log by operator." />,
});