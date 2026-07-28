import { useState, useEffect } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Sparkles, CheckCircle2, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type SelfHelpInfo = {
  title: string;
  whatIsIt: string;
  whyUseIt: string;
  firstStep: string;
  requiredFields: string;
  afterSaving: string;
};

interface SelfHelpCardProps {
  pageKey: string; // unique key e.g. "production", "reports", "customers"
  info: SelfHelpInfo;
}

export function SelfHelpCard({ pageKey, info }: SelfHelpCardProps) {
  const storageKey = `self_help_dismissed_${pageKey}`;
  const [open, setOpen] = useState<boolean>(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem(storageKey);
    if (isDismissed === "true") {
      setOpen(false);
    }
  }, [storageKey]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(storageKey, next ? "false" : "true");
  };

  return (
    <Card className="border-brand/30 bg-gradient-to-r from-brand/5 via-brand/10 to-transparent p-4 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-full bg-brand text-brand-foreground grid place-items-center shadow-sm">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              Guide & Help: {info.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              Simple business explanation & step-by-step guide for non-technical users
            </p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={toggle} className="gap-1.5 text-xs">
          <HelpCircle className="size-3.5" />
          {open ? "Hide Guide" : "Show Guide"}
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </div>

      {open && (
        <div className="mt-4 pt-3 border-t border-brand/20 grid gap-3 sm:grid-cols-2 text-xs">
          <div className="space-y-1 bg-background/60 p-3 rounded-lg border border-border/50">
            <div className="font-semibold text-brand flex items-center gap-1.5">
              <Info className="size-3.5" /> What is this page?
            </div>
            <p className="text-muted-foreground">{info.whatIsIt}</p>
          </div>

          <div className="space-y-1 bg-background/60 p-3 rounded-lg border border-border/50">
            <div className="font-semibold text-brand flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" /> Why do we use it?
            </div>
            <p className="text-muted-foreground">{info.whyUseIt}</p>
          </div>

          <div className="space-y-1 bg-background/60 p-3 rounded-lg border border-border/50">
            <div className="font-semibold text-brand flex items-center gap-1.5">
              1. What button to click first?
            </div>
            <p className="text-muted-foreground">{info.firstStep}</p>
          </div>

          <div className="space-y-1 bg-background/60 p-3 rounded-lg border border-border/50">
            <div className="font-semibold text-brand flex items-center gap-1.5">
              2. What information is required?
            </div>
            <p className="text-muted-foreground">{info.requiredFields}</p>
          </div>

          <div className="sm:col-span-2 space-y-1 bg-background/60 p-3 rounded-lg border border-border/50">
            <div className="font-semibold text-brand flex items-center gap-1.5">
              3. What happens after saving?
            </div>
            <p className="text-muted-foreground">{info.afterSaving}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

// Inline Form Tip component for input fields
export function FormTip({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
      <Info className="size-3 shrink-0 text-brand mt-0.5" />
      <span>{text}</span>
    </p>
  );
}
