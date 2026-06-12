import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Upload, Loader2, FileText, CheckCircle2, AlertTriangle, XCircle,
  Eye, Hash, User, Calendar, Zap, DollarSign, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ExtractionResult = {
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
  total_amount?: number | null;
  raw_text?: string | null;
  validation_warnings?: string[];
  warning?: string;
};

function ConfidenceMeter({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : value >= 40 ? "bg-orange-500" : "bg-red-500";
  const label =
    value >= 80 ? "High" : value >= 60 ? "Medium" : value >= 40 ? "Low" : "Very Low";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">OCR Confidence</span>
        <span className={cn("font-bold", value >= 80 ? "text-green-600" : value >= 60 ? "text-yellow-600" : "text-red-600")}>
          {value}% — {label}
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const empty = value == null || value === "";
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0 w-36">{label}</span>
      <span className={cn("text-xs text-right flex-1 font-mono", empty ? "text-muted-foreground/40 italic" : "text-foreground font-medium")}>
        {empty ? "—" : String(value)}
      </span>
    </div>
  );
}

export default function OcrDebugPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<{ extraction: ExtractionResult } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!token) return;
    if (fileRef.current) fileRef.current.value = "";

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "JPG, PNG, or WebP only.", variant: "destructive" });
      return;
    }

    // Show local preview
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch("/api/bills/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await resp.json();
      if (!resp.ok) {
        // Non-bill or server error
        setResult({
          extraction: {
            is_bill: false,
            confidence: 0,
            error: json.error ?? "Upload failed",
          },
        });
        return;
      }
      setResult({ extraction: json.extractedFields as ExtractionResult });
    } catch {
      toast({ title: "Network error", description: "Could not reach server.", variant: "destructive" });
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

  const ext = result?.extraction;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Eye className="h-6 w-6 text-primary" />
          OCR Debug Panel
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Test bill extraction accuracy — see exactly what the AI reads from your bill image
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Upload + Image preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Bill Image
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    <p className="text-xs text-muted-foreground">Processing with AI…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-6 w-6 text-muted-foreground/60" />
                    <p className="text-xs">Drop image or click to browse</p>
                    <p className="text-xs text-muted-foreground">JPG / PNG / WebP</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </CardContent>
          </Card>

          {previewUrl && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Uploaded Image</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={previewUrl}
                  alt="Uploaded bill"
                  className="w-full rounded-lg border border-border object-contain max-h-80"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Extraction results */}
        <div className="space-y-4">
          {!ext && !uploading && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                Upload a bill image to see OCR extraction results
              </CardContent>
            </Card>
          )}

          {ext && (
            <>
              {/* Status */}
              <Card className={ext.is_bill ? "border-primary/30" : "border-destructive/30"}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {ext.is_bill
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : <XCircle className="h-4 w-4 text-destructive" />}
                      Bill Detection
                    </CardTitle>
                    <Badge variant={ext.is_bill ? "secondary" : "destructive"}>
                      {ext.is_bill ? "VALID BILL" : "NOT A BILL"}
                    </Badge>
                  </div>
                </CardHeader>
                {ext.is_bill && (
                  <CardContent>
                    <ConfidenceMeter value={ext.confidence} />
                  </CardContent>
                )}
                {!ext.is_bill && ext.error && (
                  <CardContent>
                    <p className="text-sm text-destructive">{ext.error}</p>
                  </CardContent>
                )}
              </Card>

              {ext.is_bill && (
                <>
                  {/* Validation warnings */}
                  {ext.validation_warnings && ext.validation_warnings.length > 0 && (
                    <Card className="border-yellow-500/30 bg-yellow-500/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          Validation Warnings
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {ext.validation_warnings.map((w, i) => (
                            <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0">•</span>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Customer info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" />
                        Consumer Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <FieldRow label="DISCO / Provider" value={ext.electricity_provider} />
                      <FieldRow label="Customer Name" value={ext.customer_name} />
                      <FieldRow label="Reference No." value={ext.reference_number} />
                      <FieldRow label="Consumer ID" value={ext.consumer_id} />
                      <FieldRow label="Meter Number" value={ext.meter_number} />
                    </CardContent>
                  </Card>

                  {/* Dates */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Dates
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <FieldRow label="Billing Month" value={ext.billing_month} />
                      <FieldRow label="Issue Date" value={ext.issue_date} />
                      <FieldRow label="Due Date" value={ext.due_date} />
                    </CardContent>
                  </Card>

                  {/* Readings */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Meter Readings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <FieldRow label="Previous Reading" value={ext.previous_reading} />
                      <FieldRow label="Current Reading" value={ext.current_reading} />
                      <FieldRow label="Units Consumed" value={ext.units_consumed != null ? `${ext.units_consumed} kWh` : null} />
                    </CardContent>
                  </Card>

                  {/* Charges */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Charges
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <FieldRow label="Energy Charges" value={ext.energy_charges != null ? `Rs. ${ext.energy_charges}` : null} />
                      <FieldRow label="FCA / FPA" value={ext.fca_charges != null ? `Rs. ${ext.fca_charges}` : null} />
                      <FieldRow label="TV Fee" value={ext.tv_fee != null ? `Rs. ${ext.tv_fee}` : null} />
                      <FieldRow label="Taxes (GST etc)" value={ext.taxes != null ? `Rs. ${ext.taxes}` : null} />
                      <FieldRow label="Total Amount" value={ext.total_amount != null ? `Rs. ${ext.total_amount}` : null} />
                    </CardContent>
                  </Card>

                  {/* Raw text */}
                  {ext.raw_text && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Hash className="h-4 w-4 text-primary" />
                          Raw Text Seen by AI
                        </CardTitle>
                        <CardDescription className="text-xs">Key numbers and labels visible in the image</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground font-mono leading-relaxed bg-muted rounded-lg p-3 break-words">
                          {ext.raw_text}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
