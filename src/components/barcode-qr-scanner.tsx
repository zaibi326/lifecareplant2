import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, QrCode, Check, RefreshCw, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

export type BarcodeScannerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
  title?: string;
};

export function BarcodeQrScanner({
  open,
  onOpenChange,
  onScan,
  title = "Scan Cylinder Barcode / QR Code",
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera hardware not supported on this browser/device.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn("[scanner] camera failed:", err);
      setCameraActive(false);
      setErrorMsg(err.message || "Could not access camera. Please enter code manually.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = manualCode.trim();
    if (!val) {
      toast.error("Please enter a valid serial or barcode number");
      return;
    }
    onScan(val);
    setManualCode("");
    onOpenChange(false);
    toast.success(`Scanned code: ${val}`);
  };

  const handleSimulateScan = () => {
    const mockCode = "CYL-" + Math.floor(100000 + Math.random() * 900000);
    onScan(mockCode);
    onOpenChange(false);
    toast.success(`Scanned: ${mockCode}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5 text-brand" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Camera Viewport Area */}
          <div className="relative aspect-video rounded-2xl bg-black overflow-hidden border-2 border-brand/30 grid place-items-center">
            {cameraActive ? (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {/* Viewfinder Target overlay */}
                <div className="absolute inset-0 border-[32px] border-black/40 pointer-events-none grid place-items-center">
                  <div className="size-48 border-2 border-brand rounded-xl relative animate-pulse shadow-lg">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-brand/80 shadow-md" />
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur text-white text-[11px] py-1 px-3 rounded-full text-center">
                  Point camera at cylinder tag or barcode
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-muted-foreground text-xs space-y-2">
                <Camera className="size-8 mx-auto opacity-40" />
                <p>{errorMsg || "Camera stream starting..."}</p>
                <Button size="sm" variant="outline" onClick={startCamera} className="gap-2 mt-2">
                  <RefreshCw className="size-3" /> Retry Camera
                </Button>
              </div>
            )}
          </div>

          {/* Quick Simulate Scan for testing */}
          <div className="flex items-center justify-between text-xs border-y py-2 text-muted-foreground">
            <span>Hardware barcode camera active</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSimulateScan}
              className="text-xs text-brand h-7 gap-1"
            >
              <Sparkles className="size-3.5" /> Sample Scan Tag
            </Button>
          </div>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <div className="text-xs font-semibold">Or Enter Barcode / Serial Number:</div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. OXY-74892"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="h-10 text-sm font-mono"
              />
              <Button type="submit" className="gap-1 bg-brand text-brand-foreground">
                <Check className="size-4" /> Submit
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
