import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => <ComingSoon title="Reports" description="Daily, monthly, customer statement and production reports." />,
});