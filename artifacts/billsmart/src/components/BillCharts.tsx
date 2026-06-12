import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, ReferenceLine, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";

// ── Shared types ─────────────────────────────────────────────────────────────

export type BillRecord = {
  id: number;
  units: number;
  billedAmount: number;
  expectedAmount: number;
  isOvercharged: boolean;
  difference: number;
  energyCharges?: number | null;
  meterRent?: number | null;
  fca?: number | null;
  gst?: number | null;
  billMonth?: string | null;
  createdAt: string;
};

// ── Colour palette (stable across charts) ────────────────────────────────────

const C = {
  energy:    "#22c55e",
  gst:       "#f59e0b",
  fca:       "#3b82f6",
  meterRent: "#8b5cf6",
  other:     "#94a3b8",
  primary:   "#10b981",
  bad:       "#ef4444",
  neutral:   "#6b7280",
  warning:   "#f97316",
};

// ── Shared chart style ────────────────────────────────────────────────────────

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};

function billLabel(b: BillRecord) {
  return b.billMonth ?? format(new Date(b.createdAt), "MMM yy");
}

function sortChron(bills: BillRecord[]) {
  return [...bills].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  MONTHLY CONSUMPTION TREND
// Min: 2 bills
// ─────────────────────────────────────────────────────────────────────────────

export function ConsumptionTrendChart({ bills }: { bills: BillRecord[] }) {
  if (bills.length < 2) return null;

  const data = sortChron(bills).map((b) => ({
    month: billLabel(b),
    units: b.units,
    billed: b.billedAmount,
    expected: b.expectedAmount,
    overcharged: b.isOvercharged,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Monthly Consumption Trend</CardTitle>
        <CardDescription>Track how your usage and bill amount change over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="units" orientation="left" tick={{ fontSize: 11 }} unit=" u" width={52} />
            <YAxis yAxisId="amount" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={42} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => {
                if (name === "Units") return [`${value} kWh`, name];
                return [`Rs. ${value.toLocaleString()}`, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Line yAxisId="units" type="monotone" dataKey="units" name="Units" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Bar yAxisId="amount" dataKey="billed" name="Billed (Rs.)" radius={[3, 3, 0, 0]} maxBarSize={32}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.overcharged ? C.bad : C.fca} fillOpacity={0.75} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2">
          <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: C.bad }} />overcharged &nbsp;
          <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ background: C.fca }} />correct
        </p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2.  ANOMALY DETECTION
// Min: 3 bills
// ─────────────────────────────────────────────────────────────────────────────

export function AnomalyDetectionChart({ bills }: { bills: BillRecord[] }) {
  if (bills.length < 3) return null;

  const sorted = sortChron(bills);
  const avgUnits = sorted.reduce((s, b) => s + b.units, 0) / sorted.length;
  const avgBilled = sorted.reduce((s, b) => s + b.billedAmount, 0) / sorted.length;
  const threshold = avgUnits * 1.2;

  const data = sorted.map((b) => ({
    month: billLabel(b),
    units: b.units,
    billed: b.billedAmount,
    spike: b.units > threshold,
  }));

  const lastBill = data[data.length - 1];
  const lastIsAnomaly = lastBill.units > threshold;

  return (
    <Card className={lastIsAnomaly ? "border-orange-400/50" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Consumption Anomaly Detection</CardTitle>
            <CardDescription>Spot unusual spikes vs your historical average</CardDescription>
          </div>
          {lastIsAnomaly && (
            <Badge variant="destructive" className="shrink-0">Spike Detected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg Units / month</p>
            <p className="text-lg font-bold mt-0.5">{Math.round(avgUnits)} kWh</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground">Avg Bill / month</p>
            <p className="text-lg font-bold mt-0.5">Rs. {Math.round(avgBilled).toLocaleString()}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit=" u" width={50} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => [`${value} kWh`, "Units Consumed"]}
            />
            <ReferenceLine y={avgUnits} stroke={C.neutral} strokeDasharray="4 4" label={{ value: "avg", position: "right", fontSize: 10, fill: C.neutral }} />
            <ReferenceLine y={threshold} stroke={C.warning} strokeDasharray="4 4" label={{ value: "+20%", position: "right", fontSize: 10, fill: C.warning }} />
            <Bar dataKey="units" maxBarSize={36} radius={[3, 3, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.spike ? C.warning : C.primary} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2">
          Orange bars are &gt;20% above your average — investigate these months.
        </p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3.  BILL HEALTH SCORE
// Min: 1 bill
// ─────────────────────────────────────────────────────────────────────────────

function computeHealthScore(bills: BillRecord[]) {
  if (!bills.length) return { total: 0, accuracy: 0, consistency: 0, efficiency: 0 };

  // Accuracy (0–40): % of bills that are NOT overcharged
  const correctRate = bills.filter((b) => !b.isOvercharged).length / bills.length;
  const accuracy = Math.round(correctRate * 40);

  // Consistency (0–30): coefficient of variation of units
  const units = bills.map((b) => b.units);
  const mean = units.reduce((s, u) => s + u, 0) / units.length;
  const std = Math.sqrt(units.map((u) => (u - mean) ** 2).reduce((s, v) => s + v, 0) / units.length);
  const cv = mean > 0 ? std / mean : 1;
  const consistency = bills.length < 2 ? 15 : Math.round(Math.max(0, 30 - cv * 60));

  // Efficiency (0–30): based on average consumption bracket
  const avgU = mean;
  const efficiency =
    avgU <= 100 ? 30 :
    avgU <= 200 ? 26 :
    avgU <= 300 ? 22 :
    avgU <= 400 ? 18 :
    avgU <= 500 ? 12 :
    avgU <= 700 ? 6 : 2;

  return {
    total: Math.min(100, accuracy + consistency + efficiency),
    accuracy,
    consistency,
    efficiency,
  };
}

function CircleGauge({ value }: { value: number }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  const color = value >= 75 ? "#22c55e" : value >= 50 ? "#f59e0b" : "#ef4444";
  const label = value >= 75 ? "Good" : value >= 50 ? "Fair" : "Needs Attention";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={`${progress} ${circumference - progress}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none" style={{ color }}>{value}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function BillHealthScore({ bills }: { bills: BillRecord[] }) {
  if (!bills.length) return null;
  const scores = computeHealthScore(bills);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Bill Health Score</CardTitle>
        <CardDescription>Overall rating based on accuracy, consistency, and efficiency</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          <CircleGauge value={scores.total} />
          <div className="flex-1 space-y-3">
            <ScoreBar label="Billing Accuracy (no overcharges)" value={scores.accuracy} max={40} />
            <ScoreBar label="Consumption Consistency" value={scores.consistency} max={30} />
            <ScoreBar label="Tariff Efficiency (lower usage)" value={scores.efficiency} max={30} />
          </div>
        </div>
        {bills.length < 3 && (
          <p className="text-xs text-muted-foreground mt-3">
            ℹ Consistency score improves as you save more bills (need ≥3).
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4.  BILL BREAKDOWN DONUT
// Needs: energyCharges or fca or gst
// ─────────────────────────────────────────────────────────────────────────────

export type BreakdownProps = {
  billedAmount: number;
  energyCharges?: number | null;
  meterRent?: number | null;
  fca?: number | null;
  gst?: number | null;
};

export function BillBreakdownDonut({ billedAmount, energyCharges, meterRent, fca, gst }: BreakdownProps) {
  const hasData = energyCharges != null || fca != null || gst != null;
  if (!hasData) return null;

  const energy = energyCharges ?? 0;
  const rent   = meterRent ?? 0;
  const fcaVal = fca ?? 0;
  const gstVal = gst ?? 0;
  const other  = Math.max(0, billedAmount - energy - rent - fcaVal - gstVal);

  const segments = [
    { name: "Energy Charges", value: energy, color: C.energy },
    { name: "GST",            value: gstVal, color: C.gst    },
    { name: "FCA / FPA",      value: fcaVal, color: C.fca    },
    { name: "Meter Rent",     value: rent,   color: C.meterRent },
    { name: "Other",          value: other,  color: C.other  },
  ].filter((s) => s.value > 0);

  const total = segments.reduce((s, d) => s + d.value, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Where Your Money Goes</CardTitle>
        <CardDescription>Breakdown of charges in this bill</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <ResponsiveContainer width={150} height={150}>
              <PieChart>
                <Pie
                  data={segments}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={68}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {segments.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number, name: string) => [
                    `Rs. ${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {segments.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-muted-foreground">{s.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">Rs. {s.value.toLocaleString()}</span>
                  <span className="text-muted-foreground ml-1">({((s.value / total) * 100).toFixed(0)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5.  SAVINGS OPPORTUNITY
// Needs: current expectedAmount + units
// ─────────────────────────────────────────────────────────────────────────────

export function SavingsOpportunityChart({ units, expectedAmount }: { units: number; expectedAmount: number }) {
  if (!units || !expectedAmount) return null;

  const ratePerUnit = expectedAmount / units;

  const data = [5, 10, 15, 20].map((pct) => {
    const savedUnits = Math.round(units * pct / 100);
    const savedAmt = Math.round(ratePerUnit * savedUnits * 1.17); // ~incl. GST cascade
    return {
      label: `${pct}% less`,
      savedUnits,
      savedMonthly: savedAmt,
      savedAnnual: savedAmt * 12,
    };
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Savings Opportunity</CardTitle>
        <CardDescription>How much you could save by reducing consumption</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 60, left: 60, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `Rs.${v}`} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={58} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number, name: string) => [`Rs. ${value.toLocaleString()}`, name]}
            />
            <Bar dataKey="savedMonthly" name="Monthly Saving" fill={C.primary} radius={[0, 4, 4, 0]} maxBarSize={18}
              label={{ position: "right", fontSize: 10, formatter: (v: number) => `Rs.${v.toLocaleString()}` }}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {data.map((d) => (
            <div key={d.label} className="text-center rounded-lg bg-muted/30 border p-2">
              <p className="text-[10px] text-muted-foreground">{d.label}</p>
              <p className="text-xs font-semibold text-primary">Rs. {d.savedAnnual.toLocaleString()}/yr</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.  BILL INCREASE REASONS
// Needs: current bill + previous bill with charge data
// ─────────────────────────────────────────────────────────────────────────────

export type IncreaseReasonsProps = {
  current: { units: number; billedAmount: number; energyCharges?: number | null; fca?: number | null; gst?: number | null };
  previous: BillRecord;
};

export function BillIncreaseReasonsChart({ current, previous }: IncreaseReasonsProps) {
  const hasCurrent = current.energyCharges != null || current.fca != null || current.gst != null;
  const hasPrev = previous.energyCharges != null || previous.fca != null || previous.gst != null;
  if (!hasCurrent || !hasPrev) return null;

  const totalChange = current.billedAmount - previous.billedAmount;
  if (Math.abs(totalChange) < 10) return null;

  const rows = [
    { label: "Units change",     delta: (current.units - previous.units) * (current.billedAmount / current.units) },
    { label: "Energy charges",   delta: (current.energyCharges ?? 0) - (previous.energyCharges ?? 0) },
    { label: "FCA / FPA",        delta: (current.fca ?? 0) - (previous.fca ?? 0) },
    { label: "Taxes (GST etc.)", delta: (current.gst ?? 0) - (previous.gst ?? 0) },
  ].filter((r) => Math.abs(r.delta) > 5);

  if (!rows.length) return null;

  const direction = totalChange > 0 ? "increased" : "decreased";
  const Icon = totalChange > 0 ? TrendingUp : totalChange < 0 ? TrendingDown : Minus;
  const iconColor = totalChange > 0 ? "text-destructive" : "text-green-600";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
          <div>
            <CardTitle className="text-base">Why Did Your Bill {totalChange > 0 ? "Increase" : "Decrease"}?</CardTitle>
            <CardDescription>
              Bill {direction} by Rs. {Math.abs(totalChange).toLocaleString()} vs last month
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((r) => {
            const isIncrease = r.delta > 0;
            const pct = ((Math.abs(r.delta) / Math.abs(totalChange)) * 100).toFixed(0);
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-32 shrink-0">{r.label}</span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden flex items-center">
                    <div
                      className={cn("h-full rounded-sm transition-all", isIncrease ? "bg-red-500/70" : "bg-green-500/70")}
                      style={{ width: `${Math.min(100, Number(pct))}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-medium w-24 text-right shrink-0", isIncrease ? "text-destructive" : "text-green-600")}>
                    {isIncrease ? "+" : ""}Rs. {Math.round(r.delta).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7.  BILL COMPARISON VIEW
// Needs: bills.length >= 2, user selects two
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

function CompareCell({ a, b, unit = "", fmt }: { a: number; b: number; unit?: string; fmt?: (v: number) => string }) {
  const format2 = fmt ?? ((v: number) => v.toLocaleString());
  const diff = a - b;
  const worse = diff > 0;
  return (
    <div className="text-right text-xs">
      <span className={cn("font-medium", worse ? "text-destructive" : diff < 0 ? "text-green-600" : "")}>
        {unit}{format2(a)}
      </span>
      {Math.abs(diff) > 0 && (
        <span className={cn("ml-1 text-[10px]", worse ? "text-destructive/70" : "text-green-600/70")}>
          ({worse ? "+" : ""}{unit}{format2(Math.abs(diff))})
        </span>
      )}
    </div>
  );
}

export function BillComparisonView({ bills }: { bills: BillRecord[] }) {
  const [idA, setIdA] = useState<number>(bills[0]?.id ?? 0);
  const [idB, setIdB] = useState<number>(bills[1]?.id ?? 0);

  if (bills.length < 2) return null;

  const billA = bills.find((b) => b.id === idA) ?? bills[0];
  const billB = bills.find((b) => b.id === idB) ?? bills[1];

  const rows: { label: string; a: number; b: number; unit?: string; fmt?: (v: number) => string; lowerIsBetter?: boolean }[] = [
    { label: "Units Consumed",    a: billA.units,         b: billB.units,         unit: "", fmt: (v) => `${v} kWh`         },
    { label: "Billed Amount",     a: billA.billedAmount,  b: billB.billedAmount,  unit: "Rs. "                             },
    { label: "NEPRA Expected",    a: billA.expectedAmount,b: billB.expectedAmount,unit: "Rs. "                             },
    { label: "Overcharge",        a: billA.difference,    b: billB.difference,    unit: "Rs. "                             },
    ...(billA.energyCharges != null && billB.energyCharges != null ? [
      { label: "Energy Charges",  a: billA.energyCharges!, b: billB.energyCharges!, unit: "Rs. " }
    ] : []),
    ...(billA.fca != null && billB.fca != null ? [
      { label: "FCA / FPA",       a: billA.fca!,          b: billB.fca!,          unit: "Rs. " }
    ] : []),
    ...(billA.gst != null && billB.gst != null ? [
      { label: "GST",             a: billA.gst!,          b: billB.gst!,          unit: "Rs. " }
    ] : []),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Bill Comparison</CardTitle>
        <CardDescription>Compare two bills side by side to understand changes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selectors */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <select
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            value={idA}
            onChange={(e) => setIdA(Number(e.target.value))}
          >
            {bills.map((b) => <option key={b.id} value={b.id}>{billLabel(b)}</option>)}
          </select>
          <span className="text-xs text-muted-foreground font-medium text-center">vs</span>
          <select
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            value={idB}
            onChange={(e) => setIdB(Number(e.target.value))}
          >
            {bills.map((b) => <option key={b.id} value={b.id}>{billLabel(b)}</option>)}
          </select>
        </div>

        {/* Status badges */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-center">
          <Badge variant={billA.isOvercharged ? "destructive" : "secondary"} className="justify-center">
            {billLabel(billA)} — {billA.isOvercharged ? "Overcharged" : "Correct"}
          </Badge>
          <span />
          <Badge variant={billB.isOvercharged ? "destructive" : "secondary"} className="justify-center">
            {billLabel(billB)} — {billB.isOvercharged ? "Overcharged" : "Correct"}
          </Badge>
        </div>

        {/* Comparison rows */}
        {idA !== idB && (
          <div className="space-y-0">
            <div className="grid grid-cols-[1fr_100px_1fr] gap-1 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
              <span>{billLabel(billA)}</span>
              <span className="text-center">Metric</span>
              <span className="text-right">{billLabel(billB)}</span>
            </div>
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[1fr_100px_1fr] gap-1 py-2 border-b border-border/40 last:border-0 items-center">
                <CompareCell a={r.a} b={r.b} unit={r.unit} fmt={r.fmt} />
                <span className="text-[10px] text-muted-foreground text-center">{r.label}</span>
                <div className="text-left">
                  <span className="text-xs font-medium">{r.unit}{(r.fmt ?? ((v: number) => v.toLocaleString()))(r.b)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {idA === idB && (
          <p className="text-xs text-muted-foreground text-center py-4">Select two different bills to compare.</p>
        )}
      </CardContent>
    </Card>
  );
}
