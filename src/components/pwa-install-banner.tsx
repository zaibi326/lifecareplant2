import { useEffect, useState } from "react";
import { Download, X, Smartphone, MonitorCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone;
    if (isStandalone) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Show iOS banner once if not installed
    if (iosDevice && !localStorage.getItem("pwa_prompt_dismissed")) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast.success("Life Care Plant ERP installed!");
      }
      setDeferredPrompt(null);
      setShowBanner(false);
    } else if (isIOS) {
      toast.info("On iOS: Tap Share button and select 'Add to Home Screen'");
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa_prompt_dismissed", "true");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40 bg-card border border-brand/40 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-10 rounded-xl bg-brand text-brand-foreground grid place-items-center shrink-0">
          <Smartphone className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="font-display font-bold text-sm truncate">Install Plant ERP App</div>
          <div className="text-xs text-muted-foreground truncate">
            {isIOS ? "Tap Share > Add to Home Screen" : "Use offline without app store"}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          onClick={handleInstallClick}
          className="gap-1.5 bg-brand text-brand-foreground h-8 text-xs font-semibold"
        >
          <Download className="size-3.5" /> Install
        </Button>
        <button
          onClick={handleDismiss}
          className="size-7 rounded-lg text-muted-foreground hover:bg-muted grid place-items-center"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
