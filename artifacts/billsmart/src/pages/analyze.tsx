import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, CheckCircle2, Upload, Loader2, FileText,
  Calculator, ChevronDown, ChevronUp, ShieldAlert, Zap,
  User, Calendar, Gauge, Receipt, ArrowRight, ImageIcon,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

export type ExtractionResult = {
  is_bill: boolean;
  confidence: number;
  error?: string;
  electricity_provider?: string | null;
  customer_name?: string | null;
  reference_number?: string | null;
  consumer_id?: string | null;
  meter_number?: string | null;
  billing_month?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  previous_reading?: number | null;
  current_reading?: number | null;
  units_consumed?: number | null;
  energy_charges?: number | null;
  fca_charges?: number | null;
  tv_fee?: number | null;
  taxes?: number | null;
  current_bill?: number | null;
  total_amount?: number | null;
  payable_after_due_date?: number | null;
  raw_text?: string | null;
  validation_warnings?: string[];
};

export type AnalysisResult = {
  units: number;
  billedAmount: number;
  expectedAmount: number;
  isOvercharged: boolean;
  difference: number;
  message?: string | null;
  energyCharges?: number | null;
  meterRent?: number | null;
  fca?: number | null;
  gst?: number | null;
  slabBreakdown?: Array<{ label: string; units: number; rate: number; charge: number }>;
};

export type PendingAnalysis = {
  extraction: ExtractionResult;
  analysis: AnalysisResult;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function ConfidenceMeter({ value }: { value: number }) {
  const bar = value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : value >= 40 ? "bg-orange-500" : "bg-red-500";
  const text = value >= 80 ? "text-green-600 dark:text-green-400" : value >= 60 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const label = value >= 80 ? "High confidence" : value >= 60 ? "Medium confidence" : value >= 40 ? "Low confidence" : "Very low";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Extraction accuracy</span>
        <span className={cn("font-semibold", text)}>{value}% — {label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value?: string | number | null; highlight?: boolean }) {
  const empty = value == null || value === "";
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={cn(
        "text-xs text-right font-medium",
        empty ? "text-muted-foreground/30 italic" : highlight ? "text-primary" : "text-foreground"
      )}>
        {empty ? "—" : String(value)}
      </span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Form ─────────────────────────────────────────────────────────────────────

const formSchema = z.object({
  units: z.coerce.number().int().min(1, "Must be at least 1"),
  billedAmount: z.coerce.number().min(1, "Must be positive"),
});
type FormData = z.infer<typeof formSchema>;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { units: "" as unknown as number, billedAmount: "" as unknown as number },
  });

  // ── Upload ─────────────────────────────────────────────────────────────────

  async function uploadFile(file: File) {
    if (!token) return;
    if (fileRef.current) fileRef.current.value = "";
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }

    // Local preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setExtraction(null);
    form.reset({ units: "" as unknown as number, billedAmount: "" as unknown as number });

    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("http://localhost:8080/api/bills/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast({ title: "Not a valid bill", description: json.error ?? "Please upload a Pakistani electricity bill.", variant: "destructive" });
        setPreviewUrl(null);
        return;
      }

      const ext = json.extractedFields as ExtractionResult;
      setExtraction(ext);

      if (ext.units_consumed && ext.units_consumed > 0) form.setValue("units", ext.units_consumed);
      if (ext.total_amount && ext.total_amount > 0) form.setValue("billedAmount", ext.total_amount);

      const conf = ext.confidence ?? 0;
      if (conf >= 70) {
        toast({ title: "Bill extracted", description: `${conf}% confidence — verify the values below.` });
      } else {
        toast({
          title: "Partial extraction",
          description: "Low image quality. Please verify all values before continuing.",
          variant: "destructive",
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
    if (f) uploadFile(f);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  }, [token]);

  // ── Analysis ───────────────────────────────────────────────────────────────

  async function onRunAnalysis(data: FormData) {
    if (!token) return;
    setAnalyzing(true);
    try {
      const resp = await fetch("http://localhost:8080/api/bills/check", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ units: data.units, billedAmount: data.billedAmount }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast({ title: "Analysis failed", description: json.error ?? "Could not calculate.", variant: "destructive" });
        return;
      }
      // Store result in sessionStorage then navigate
      const pending: PendingAnalysis = {
        extraction: extraction ?? { is_bill: false, confidence: 0 },
        analysis: json as AnalysisResult,
      };
      sessionStorage.setItem("billsmart_analysis", JSON.stringify(pending));
      navigate("/analysis");
    } catch {
      toast({ title: "Analysis failed", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }

  const isLoading = uploading || analyzing;
  const hasExtraction = extraction && extraction.is_bill;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Analyze Bill</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload your electricity bill image — AI extracts all fields automatically
        </p>
      </div>

      {/* ── Upload zone (collapses after upload) ── */}
      {!hasExtraction && (
        <Card>
          <CardContent className="pt-5">
            <div
              data-testid="upload-zone"
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <div>
                    <p className="text-sm font-medium">Reading bill with AI…</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Preprocessing image and extracting all fields</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Drop your bill image here</p>
                    <p className="text-xs text-muted-foreground mt-1">Supports JPG, PNG, WebP · Max 10MB</p>
                  </div>
                  <Button variant="outline" size="sm" type="button">Browse File</Button>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} data-testid="input-file" />
          </CardContent>
        </Card>
      )}

      {/* ── Main two-column layout after extraction ── */}
      {hasExtraction && (
        <div className="grid md:grid-cols-[280px_1fr] gap-5 items-start">

          {/* Left: image + confidence */}
          <div className="space-y-3">
            <Card className="overflow-hidden">
              {previewUrl && (
                <img src={previewUrl} alt="Bill" className="w-full object-contain max-h-72 bg-muted" />
              )}
              <CardContent className="pt-3 pb-4 space-y-3">
                <div className="flex items-center gap-2">
                  {extraction.electricity_provider && (
                    <Badge variant="secondary" className="gap-1">
                      <Zap className="h-3 w-3" />
                      {extraction.electricity_provider}
                    </Badge>
                  )}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {extraction.confidence}%
                  </Badge>
                </div>
                <ConfidenceMeter value={extraction.confidence} />
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  onClick={() => { setExtraction(null); setPreviewUrl(null); }}
                >
                  <Upload className="h-3 w-3" /> Change image
                </button>
              </CardContent>
            </Card>

            {/* Validation warnings */}
            {extraction.validation_warnings && extraction.validation_warnings.length > 0 && (
              <Card className="border-yellow-500/40 bg-yellow-500/5">
                <CardContent className="pt-3 pb-3 space-y-1.5">
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Warnings
                  </p>
                  {extraction.validation_warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-yellow-700/80 dark:text-yellow-400/80 leading-snug">• {w}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: extracted field sections */}
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-5 space-y-5">

                {/* Consumer Info */}
                <SectionCard icon={User} title="Consumer Information">
                  <InfoRow label="Name" value={extraction.customer_name} />
                  <InfoRow label="Consumer ID" value={extraction.consumer_id} />
                  <InfoRow label="Reference No." value={extraction.reference_number} />
                  <InfoRow label="Meter Number" value={extraction.meter_number} />
                </SectionCard>

                <Separator />

                {/* Billing Period */}
                <SectionCard icon={Calendar} title="Billing Period">
                  <InfoRow label="Billing Month" value={extraction.billing_month} />
                  <InfoRow label="Issue Date" value={extraction.issue_date} />
                  <InfoRow label="Due Date" value={extraction.due_date} />
                </SectionCard>

                <Separator />

                {/* Meter Readings */}
                <SectionCard icon={Gauge} title="Meter Readings">
                  <InfoRow label="Previous Reading" value={extraction.previous_reading} />
                  <InfoRow label="Current Reading" value={extraction.current_reading} />
                  <InfoRow label="Units Consumed" value={extraction.units_consumed != null ? `${extraction.units_consumed} kWh` : null} highlight />
                </SectionCard>

                <Separator />

                {/* Charges */}
                <SectionCard icon={Receipt} title="Charges">
                  <InfoRow label="Energy / DISCO Charges" value={extraction.energy_charges != null ? `Rs. ${extraction.energy_charges.toLocaleString()}` : null} />
                  <InfoRow label="Fuel Price Adjustment (FCA)" value={extraction.fca_charges != null ? `Rs. ${extraction.fca_charges.toLocaleString()}` : null} />
                  <InfoRow label="TV Fee" value={extraction.tv_fee != null ? `Rs. ${extraction.tv_fee.toLocaleString()}` : null} />
                  <InfoRow label="Government Charges / Taxes" value={extraction.taxes != null ? `Rs. ${extraction.taxes.toLocaleString()}` : null} />
                  <InfoRow label="Current Bill" value={extraction.current_bill != null ? `Rs. ${extraction.current_bill.toLocaleString()}` : null} />
                  <InfoRow label="Payable Within Due Date" value={extraction.total_amount != null ? `Rs. ${extraction.total_amount.toLocaleString()}` : null} highlight />
                  {extraction.payable_after_due_date != null && (
                    <InfoRow label="Payable After Due Date" value={`Rs. ${extraction.payable_after_due_date.toLocaleString()}`} />
                  )}
                </SectionCard>

                {/* Raw text toggle */}
                {extraction.raw_text && (
                  <>
                    <Separator />
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowRaw(!showRaw)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showRaw ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {showRaw ? "Hide" : "Show"} raw OCR text
                      </button>
                      {showRaw && (
                        <p className="mt-2 text-[11px] font-mono text-muted-foreground leading-relaxed bg-muted rounded-lg p-2.5 break-words">
                          {extraction.raw_text}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Verify & Run form */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-primary" />
                  Verify & Continue to Analysis
                </CardTitle>
                <CardDescription className="text-xs">
                  Values pre-filled from your bill — correct any errors before running the overcharge check
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onRunAnalysis)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="units">Units Consumed (kWh)</Label>
                      <Input id="units" type="number" placeholder="e.g. 350" data-testid="input-units" {...form.register("units")} />
                      {form.formState.errors.units && <p className="text-xs text-destructive">{form.formState.errors.units.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="billed">Payable Amount (Rs.)</Label>
                      <Input id="billed" type="number" placeholder="e.g. 5500" data-testid="input-billed-amount" {...form.register("billedAmount")} />
                      {form.formState.errors.billedAmount && <p className="text-xs text-destructive">{form.formState.errors.billedAmount.message}</p>}
                    </div>
                  </div>
                  {extraction.confidence < 60 && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-orange-400/30 bg-orange-400/10 text-xs text-orange-700 dark:text-orange-400">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      Low confidence — please verify units and payable amount before proceeding
                    </div>
                  )}
                  <Button type="submit" className="w-full gap-2" disabled={isLoading} data-testid="button-check">
                    {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    {analyzing ? "Calculating…" : "Continue to Detailed Analysis"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Manual entry (shown when no image uploaded) ── */}
      {!hasExtraction && !uploading && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Or Enter Bill Details Manually
            </CardTitle>
            <CardDescription>Enter values directly from your electricity bill</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onRunAnalysis)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="units-m">Units Consumed (kWh)</Label>
                  <Input id="units-m" type="number" placeholder="e.g. 350" {...form.register("units")} />
                  {form.formState.errors.units && <p className="text-xs text-destructive">{form.formState.errors.units.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="billed-m">Payable Within Due Date (Rs.)</Label>
                  <Input id="billed-m" type="number" placeholder="e.g. 5500" {...form.register("billedAmount")} />
                  {form.formState.errors.billedAmount && <p className="text-xs text-destructive">{form.formState.errors.billedAmount.message}</p>}
                </div>
              </div>
              <Button type="submit" className="w-full gap-2" disabled={isLoading} data-testid="button-check">
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {analyzing ? "Calculating…" : "Continue to Detailed Analysis"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
