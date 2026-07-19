import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Flame } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Life Care Plant" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  if (!mounted) return null;


  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="size-14 rounded-2xl bg-brand text-brand-foreground flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand/20">
            <Flame className="size-7" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Life Care Plant</h1>
          <p className="text-sm text-muted-foreground mt-1">Gas Cylinder Plant Management</p>
        </div>
        <div className="bg-card rounded-3xl border p-6 shadow-sm">
          <h2 className="font-display text-xl font-bold mb-1">Sign in</h2>
          <p className="text-xs text-muted-foreground mb-6">Use the credentials provided by your plant admin.</p>
          <form onSubmit={handle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" required minLength={6} />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold rounded-xl">
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              Sign in
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Public sign-ups are disabled. Contact your plant admin for an account.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground text-center mt-6">
          Powered by Braintech Automation
        </p>
      </div>
    </div>
  );
}