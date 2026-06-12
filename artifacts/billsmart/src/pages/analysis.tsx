import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useSaveBill, useListBills, getListBillsQueryKey, getGetStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, CheckCircle2, ArrowLeft, Save, Loader2,
  TrendingDown, Receipt, Info, FileText, Copy, Download, Check,
} from "lucide-react";
import {
  BillBreakdownDonut,
  SavingsOpportunityChart,
  BillIncreaseReasonsChart,
  type BillRecord,
} from "@/components/BillCharts";
import type { PendingAnalysis } from "./analyze";

// ── Complaint Letter Dialog ───────────────────────────────────────────────────

function ComplaintLetterDialog({
  open, onClose, letter, loading, discoName, billingMonth,
}: {
  open: boolean; onClose: () => void; letter: string; loading: boolean;
  discoName?: string | null; billingMonth?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function handleCopy() {
    navigator.clipboard.writeText(letter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([letter], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const disco = discoName ?? "DISCO";
    const month = billingMonth ? `-${billingMonth.replace(/\s+/g, "-")}` : "";
    a.href = url;
    a.download = `complaint-letter-${disco}${month}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Complaint letter saved as .txt file." });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Complaint Letter
          </DialogTitle>
          <DialogDescription>
            AI-generated formal complaint addressed to {discoName ?? "your DISCO"}.
            Review, edit if needed, then copy or download to submit.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Drafting your complaint letter…</p>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <textarea
                className="w-full min-h-[380px] h-full resize-none rounded-lg border border-border bg-muted/30 p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
                value={letter}
                readOnly
              />
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" className="gap-2 flex-1" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
              <Button className="gap-2 flex-1" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download .txt
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "text-center p-4 rounded-xl border",
      highlight ? "bg-primary/10 border-primary/30" : "bg-background border-border"
    )}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold mt-1 leading-none", highlight ? "text-primary" : "")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ChargeRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">Rs. {value.toLocaleString()}</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { token } = useAuth();
  const qc = useQueryClient();
  const saveMutation = useSaveBill();
  const { data: billsData } = useListBills();

  const [data, setData] = useState<PendingAnalysis | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [letterOpen, setLetterOpen] = useState(false);
  const [letterText, setLetterText] = useState("");
  const [letterLoading, setLetterLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("billsmart_analysis");
    if (raw) {
      try { setData(JSON.parse(raw) as PendingAnalysis); } catch { /* ignore */ }
    }
    setLoaded(true);
  }, []);

  const analysis = data?.analysis;
  const extraction = data?.extraction;
  const savedBills: BillRecord[] = billsData?.bills ?? [];
  const previousBill: BillRecord | undefined = savedBills[0];

  function saveBill() {
    if (!analysis) return;
    saveMutation.mutate(
      {
        data: {
          units: analysis.units,
          billedAmount: analysis.billedAmount,
          expectedAmount: analysis.expectedAmount,
          isOvercharged: analysis.isOvercharged,
          difference: analysis.difference,
          energyCharges: analysis.energyCharges ?? null,
          meterRent: analysis.meterRent ?? null,
          fca: analysis.fca ?? null,
          gst: analysis.gst ?? null,
          slabBreakdown: analysis.slabBreakdown ?? null,
          billMonth: extraction?.billing_month ?? null,
          meterReading: extraction?.current_reading ?? null,
        },
      } as Parameters<typeof saveMutation.mutate>[0],
      {
        onSuccess: (res) => {
          setSavedId(res.id);
          qc.invalidateQueries({ queryKey: getListBillsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          sessionStorage.removeItem("billsmart_analysis");
          toast({ title: "Bill saved", description: "Added to your history." });
        },
        onError: () => toast({ title: "Save failed", description: "Could not save bill.", variant: "destructive" }),
      }
    );
  }

  async function openComplaintLetter() {
    if (!analysis || !token) return;
    setLetterOpen(true);
    setLetterText("");
    setLetterLoading(true);
    try {
      const resp = await fetch("http://localhost:8080/api/bills/complaint", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          discoName: extraction?.electricity_provider ?? "DISCO",
          customerName: extraction?.customer_name,
          consumerId: extraction?.consumer_id,
          referenceNo: extraction?.reference_number,
          meterNo: extraction?.meter_number,
          billingMonth: extraction?.billing_month,
          units: analysis.units,
          billedAmount: analysis.billedAmount,
          expectedAmount: analysis.expectedAmount,
          difference: analysis.difference,
        }),
      });
      const json = await resp.json() as { letter?: string; error?: string };
      if (!resp.ok || !json.letter) {
        toast({ title: "Generation failed", description: json.error ?? "Could not generate letter.", variant: "destructive" });
        setLetterOpen(false);
      } else {
        setLetterText(json.letter);
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
      setLetterOpen(false);
    } finally {
      setLetterLoading(false);
    }
  }

  if (!loaded) return null;

  if (!analysis) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <TrendingDown className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold">No analysis to display</h2>
        <p className="text-muted-foreground text-sm">Upload and analyze a bill first to see the detailed results here.</p>
        <Button onClick={() => navigate("/analyze")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Go to Analyze Bill
        </Button>
      </div>
    );
  }

  const overcharged = analysis.isOvercharged;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-1" onClick={() => navigate("/analyze")}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Detailed Analysis</h1>
          {extraction?.billing_month && (
            <p className="text-sm text-muted-foreground">
              {extraction.billing_month}{extraction.electricity_provider ? ` · ${extraction.electricity_provider}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Verdict banner */}
      <Card className={cn("border-2", overcharged ? "border-destructive/50 bg-destructive/5" : "border-green-500/40 bg-green-500/5")}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0", overcharged ? "bg-destructive/15" : "bg-green-500/15")}>
              {overcharged
                ? <AlertTriangle className="h-6 w-6 text-destructive" />
                : <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-lg font-bold", overcharged ? "text-destructive" : "text-green-700 dark:text-green-400")}>
                  {overcharged ? "You were overcharged" : "Your bill is correct"}
                </span>
                <Badge variant={overcharged ? "destructive" : "secondary"}>
                  {overcharged ? "OVERCHARGED" : "No Issues"}
                </Badge>
              </div>
              {overcharged ? (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Rs. <strong className="text-destructive">{analysis.difference.toLocaleString()}</strong> charged above the NEPRA rate
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">Your bill matches the NEPRA tariff rate.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Three stat boxes */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Units Consumed" value={`${analysis.units}`} sub="kWh" />
        <StatBox label="Billed Amount" value={`Rs. ${analysis.billedAmount.toLocaleString()}`} sub="by DISCO" />
        <StatBox label="NEPRA Expected" value={`Rs. ${analysis.expectedAmount.toLocaleString()}`} sub="correct rate" highlight={overcharged} />
      </div>

      {/* Overcharge + complaint CTA */}
      {overcharged && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">Overcharge: Rs. {analysis.difference.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  File a complaint with {extraction?.electricity_provider ?? "your DISCO"} to request a correction or refund.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={openComplaintLetter}
              >
                <FileText className="h-3.5 w-3.5" />
                Draft Letter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insight charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Bill Breakdown Donut */}
        <BillBreakdownDonut
          billedAmount={analysis.billedAmount}
          energyCharges={analysis.energyCharges}
          meterRent={analysis.meterRent}
          fca={analysis.fca}
          gst={analysis.gst}
        />

        {/* NEPRA Charge Breakdown */}
        {(analysis.energyCharges != null || analysis.meterRent != null || analysis.fca != null || analysis.gst != null) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                NEPRA Charge Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {analysis.energyCharges != null && <ChargeRow label="Energy Charges" value={analysis.energyCharges} />}
              {analysis.meterRent != null && <ChargeRow label="Meter Rent" value={analysis.meterRent} />}
              {analysis.fca != null && <ChargeRow label="Fuel Charge Adjustment" value={analysis.fca} />}
              {analysis.gst != null && <ChargeRow label="GST (17%)" value={analysis.gst} />}
              <div className="flex items-center justify-between pt-2 text-sm font-semibold">
                <span>Total (NEPRA)</span>
                <span className="text-primary">Rs. {analysis.expectedAmount.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Savings Opportunity */}
      <SavingsOpportunityChart units={analysis.units} expectedAmount={analysis.expectedAmount} />

      {/* Bill Increase Reasons (vs previous saved bill) */}
      {previousBill && (
        <BillIncreaseReasonsChart
          current={{
            units: analysis.units,
            billedAmount: analysis.billedAmount,
            energyCharges: analysis.energyCharges,
            fca: analysis.fca,
            gst: analysis.gst,
          }}
          previous={previousBill}
        />
      )}

      {/* NEPRA Slab Breakdown */}
      {analysis.slabBreakdown && analysis.slabBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              NEPRA Slab Calculation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {analysis.slabBreakdown.map((slab, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <span className="text-xs text-muted-foreground">{slab.label}</span>
                <span className="text-xs text-muted-foreground">{slab.units} × Rs.{slab.rate}</span>
                <span className="text-xs font-medium">Rs. {slab.charge.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Consumer info */}
      {extraction && (extraction.customer_name || extraction.consumer_id || extraction.due_date) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Bill Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
              {[
                { label: "Name",          value: extraction.customer_name },
                { label: "Consumer ID",   value: extraction.consumer_id },
                { label: "Meter No.",     value: extraction.meter_number },
                { label: "Reference",     value: extraction.reference_number },
                { label: "Billing Month", value: extraction.billing_month },
                { label: "Due Date",      value: extraction.due_date },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label} className="py-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-xs font-medium">{String(value)}</p>
                  </div>
                ) : null
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save + actions */}
      <div className="flex gap-3 pb-4">
        {savedId ? (
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Saved to history (Bill #{savedId})
          </div>
        ) : (
          <Button onClick={saveBill} disabled={saveMutation.isPending} className="gap-2 flex-1" data-testid="button-save-bill">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save to History
          </Button>
        )}
        <Button variant="outline" onClick={() => navigate("/analyze")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Analyze Another Bill
        </Button>
      </div>

      {/* Complaint letter dialog */}
      <ComplaintLetterDialog
        open={letterOpen}
        onClose={() => setLetterOpen(false)}
        letter={letterText}
        loading={letterLoading}
        discoName={extraction?.electricity_provider}
        billingMonth={extraction?.billing_month}
      />
    </div>
  );
}
