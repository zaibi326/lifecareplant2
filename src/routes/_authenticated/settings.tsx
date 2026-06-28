import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => <ComingSoon title="Settings" description="Company info, gas types, cylinder sizes, currency, staff and more." />,
});