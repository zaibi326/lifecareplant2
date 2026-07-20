import { Sparkles } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </header>
      <div className="bg-card border rounded-3xl p-10 text-center">
        <div className="size-12 rounded-2xl bg-brand/10 text-brand grid place-items-center mx-auto mb-3">
          <Sparkles className="size-6" />
        </div>
        <p className="font-semibold">Module ready to build</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          The database, design system and shell are wired up. This screen will be implemented next.
        </p>
      </div>
    </div>
  );
}
