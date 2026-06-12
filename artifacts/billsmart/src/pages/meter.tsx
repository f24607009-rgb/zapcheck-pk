import { useState, useRef, useCallback } from "react";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Zap, Calculator, Upload, AlertTriangle,
  CheckCircle2, Loader2, Camera,
} from "lucide-react";

// NEPRA 2026 tariff slabs for non-protected domestic consumers
const SLABS = [
  { upTo: 100,      rate: 22.44 },
  { upTo: 200,      rate: 28.91 },
  { upTo: 300,      rate: 33.10 },
  { upTo: 400,      rate: 37.99 },
  { upTo: 500,      rate: 40.22 },
  { upTo: 600,      rate: 41.62 },
  { upTo: 700,      rate: 42.76 },
  { upTo: Infinity, rate: 47.69 },
];

function calculateBill(units: number): number {
  let bill = 0;
  let remaining = units;
  let prev = 0;

  for (const slab of SLABS) {
    if (remaining <= 0) break;
    const slabUnits = Math.min(remaining, slab.upTo - prev);
    bill += slabUnits * slab.rate;
    remaining -= slabUnits;
    prev = slab.upTo;
  }

  // Fixed charges: Meter Rent + TV Fee + NJ Surcharge
  const fixedCharges = 35 + 35 + 10;
  // GST at 17% on energy charges only
  const gst = bill * 0.17;
  return Math.round(bill + fixedCharges + gst);
}

type MeterExtractionResult = {
  success: boolean;
  confidence: number;
  current_reading: number | null;
  error?: string;
};

export default function MeterPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [prevReading, setPrevReading] = useState("");
  const [currReading, setCurrReading] = useState("");
  const [result, setResult] = useState<null | { units: number; amount: number }>(null);
  const [error, setError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<MeterExtractionResult | null>(null);
  // Auto-fetch previous reading from latest saved bill
useEffect(() => {
  if (!token) return;
  fetch("http://localhost:8080/api/bills/latest-reading", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.meterReading != null) {
        setPrevReading(String(data.meterReading));
      }
    })
    .catch((err) => console.error("latest-reading error:", err));
}, [token]);

  // ── Image upload handler ─────────────────────────────────────────────────

  async function uploadMeterImage(file: File) {
    if (!token) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }

    // Show local preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setExtraction(null);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const resp = await fetch("http://localhost:8080/api/meter/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const json = await resp.json() as MeterExtractionResult;

      if (!resp.ok || !json.success) {
        toast({
          title: "Could not read meter",
          description: json.error ?? "Please enter reading manually below.",
          variant: "destructive",
        });
        setPreviewUrl(null);
        return;
      }

      setExtraction(json);

      // Auto-fill current reading field if AI read it successfully
      if (json.current_reading != null) {
        setCurrReading(String(json.current_reading));
        toast({
          title: "Meter reading detected!",
          description: `Reading: ${json.current_reading} (${json.confidence}% confidence) — please verify below.`,
        });
      }
    } catch {
      toast({ title: "Upload failed", description: "Network error. Please try again.", variant: "destructive" });
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) uploadMeterImage(f);
    if (fileRef.current) fileRef.current.value = "";
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadMeterImage(f);
  }, [token]);

  // ── Bill calculation ─────────────────────────────────────────────────────

  function handleCalculate() {
    setError("");
    setResult(null);

    const prev = parseFloat(prevReading);
    const curr = parseFloat(currReading);

    if (isNaN(prev) || isNaN(curr)) {
      setError("Please enter valid numbers!");
      return;
    }
    if (curr < prev) {
      setError("Current reading cannot be less than previous reading!");
      return;
    }

    const units = curr - prev;
    const amount = calculateBill(units);
    setResult({ units, amount });
  }

  function handleReset() {
    setPrevReading("");
    setCurrReading("");
    setResult(null);
    setError("");
    setPreviewUrl(null);
    setExtraction(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meter Reading Calculator</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload your meter photo or enter readings manually to estimate your bill
        </p>
      </div>

      {/* Meter Image Upload Card */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm font-medium mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Upload Meter Photo (Optional)
          </p>

          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-medium">Reading meter with AI...</p>
                <p className="text-xs text-muted-foreground">Analyzing meter display</p>
              </div>
            ) : previewUrl && extraction ? (
              <div className="space-y-3">
                <img src={previewUrl} alt="Meter" className="max-h-40 mx-auto rounded-lg object-contain" />
                <div className="flex items-center justify-center gap-2">
                  {extraction.success ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Reading detected: {extraction.current_reading} ({extraction.confidence}% confidence)
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Could not read — enter manually
                    </Badge>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto transition-colors"
                  onClick={(e) => { e.stopPropagation(); setPreviewUrl(null); setExtraction(null); }}
                >
                  <Upload className="h-3 w-3" /> Change photo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Drop meter photo here</p>
                  <p className="text-xs text-muted-foreground mt-1">AI will read the meter automatically — Supports JPG, PNG, WebP</p>
                </div>
                <Button variant="outline" size="sm" type="button">Browse File</Button>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </CardContent>
      </Card>

      {/* Manual Input Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Previous Reading */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Previous Reading</label>
              <div className="relative">
                <Zap className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="e.g. 12400"
                  value={prevReading}
                  onChange={(e) => setPrevReading(e.target.value)}
                  type="number"
                />
              </div>
              <p className="text-xs text-muted-foreground">Last month's meter reading</p>
            </div>

            {/* Current Reading */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Current Reading</label>
              <div className="relative">
                <Zap className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="e.g. 12650"
                  value={currReading}
                  onChange={(e) => setCurrReading(e.target.value)}
                  type="number"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Today's meter reading
                {extraction?.success && (
                  <span className="text-primary ml-1">(auto-filled from photo)</span>
                )}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleCalculate} className="gap-2 flex-1">
              <Calculator className="h-4 w-4" />
              Calculate Bill
            </Button>
            {(result || previewUrl) && (
              <Button variant="outline" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result Card */}
      {result && (
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-base">Estimated Bill</h2>
              <Badge variant="secondary">Estimate</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Units Consumed</p>
                <p className="text-2xl font-bold">{result.units}</p>
                <p className="text-xs text-muted-foreground">kWh</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Estimated Amount</p>
                <p className="text-2xl font-bold text-primary">Rs. {result.amount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">incl. taxes</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              * This is an estimate based on NEPRA 2026 tariff slabs. Actual bill may vary slightly.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}