import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Trash2, Plus, Zap, Loader2, Info, TrendingUp, Calculator } from "lucide-react";

type Appliance = {
  id: number;
  name: string;
  type: string;
  watts: number;
  hoursPerDay: number;
  daysPerMonth: number;
  createdAt: string;
};

const APPLIANCE_TYPES = [
  "AC", "Fan", "Fridge", "LED Bulb", "Tube Light",
  "Washing Machine", "Iron", "Water Pump", "Microwave", "TV", "Geyser", "Other",
];

const WATTS_PLACEHOLDER: Record<string, string> = {
  AC: "e.g. 800–2000W",
  Fan: "e.g. 50–100W",
  Fridge: "e.g. 100–400W",
  "LED Bulb": "e.g. 5–15W",
  "Tube Light": "e.g. 18–40W",
  "Washing Machine": "e.g. 300–800W",
  Iron: "e.g. 1000–1800W",
  "Water Pump": "e.g. 250–750W",
  Microwave: "e.g. 700–1300W",
  TV: "e.g. 60–150W",
  Geyser: "e.g. 1500–3000W",
  Other: "Enter watts",
};
const FREQUENCY_OPTIONS = [
  { label: "Daily", value: "30" },
  { label: "Few times a week", value: "12" },
  { label: "Weekly", value: "4" },
  { label: "Monthly", value: "1" },
];
export default function AppliancesPage() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [watts, setWatts] = useState("");
const [hoursPerDay, setHoursPerDay] = useState("");
const [daysPerMonth, setDaysPerMonth] = useState("30");
type Prediction = {
  dailyKwh: number;
  monthlyUnits: number;
  predictedBill: number;
  breakdown: { energyCharges: number; meterRent: number; fca: number; gst: number };
};

const [prediction, setPrediction] = useState<Prediction | null>(null);
const [predicting, setPredicting] = useState(false);
   

  async function fetchAppliances() {
    if (!token) return;
    try {
      const resp = await fetch("http://localhost:8080/api/appliances", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await resp.json();
      setAppliances(json.appliances ?? []);
    } catch {
      toast({ title: "Error", description: "Could not load appliances.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAppliances();
  }, [token]);

  async function onAddAppliance(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (!name.trim() || !type || !watts || !hoursPerDay || !daysPerMonth) {
      toast({ title: "Missing fields", description: "Please fill all fields.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch("http://localhost:8080/api/appliances", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          watts: Number(watts),
          hoursPerDay: Number(hoursPerDay),
          daysPerMonth: Number(daysPerMonth),
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast({ title: "Failed to add", description: json.error ?? "Something went wrong.", variant: "destructive" });
        return;
      }
      setAppliances((prev) => [...prev, json]);
      setName("");
      setType("");
      setWatts("");
      setHoursPerDay("");
      setDaysPerMonth("30");
      toast({ title: "Appliance added", description: `${json.name} added successfully.` });
    } catch {
      toast({ title: "Network error", description: "Could not add appliance.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: number) {
    if (!token) return;
    try {
      await fetch(`http://localhost:8080/api/appliances/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setAppliances((prev) => prev.filter((a) => a.id !== id));
      toast({ title: "Removed" });
    } catch {
      toast({ title: "Network error", description: "Could not remove appliance.", variant: "destructive" });
    }
  }
async function onPredict() {
  if (!token) return;
  setPredicting(true);
  setPrediction(null);
  try {
    const resp = await fetch("http://localhost:8080/api/appliances/predict", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await resp.json();
    if (!resp.ok) {
      toast({ title: "Prediction failed", description: json.error ?? "Could not predict bill.", variant: "destructive" });
      return;
    }
    setPrediction(json);
  } catch {
    toast({ title: "Network error", description: "Could not predict bill.", variant: "destructive" });
  } finally {
    setPredicting(false);
  }
}
  // Total daily consumption (kWh)
  const totalDailyKwh = appliances.reduce((sum, a) => sum + (a.watts * a.hoursPerDay * a.daysPerMonth) / 30 / 1000, 0);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">My Appliances</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add your home appliances to get accurate bill predictions
        </p>
      </div>

      {/* Add Appliance Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Appliance
          </CardTitle>
          <CardDescription>Check the appliance label for its wattage (e.g. "1200W")</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAddAppliance} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Appliance Name</Label>
                <Input id="name" placeholder="e.g. Living Room AC" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="type">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLIANCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="watts">Power (Watts)</Label>
                <Input
                  id="watts"
                  type="number"
                  placeholder={type ? WATTS_PLACEHOLDER[type] : "Select type first"}
                  
                  value={watts}
                  onChange={(e) => setWatts(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  Check the label on your appliance. If not written, use: Watts = Amps × 220 or use the suggested range above as an estimate.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hours">Hours Used Per Day</Label>
                <Input id="hours" type="number" step="0.5" placeholder="e.g. 8" value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frequency">How Often Is It Used?</Label>
              <Select value={daysPerMonth} onValueChange={setDaysPerMonth}>
                <SelectTrigger id="frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Appliance
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Appliance List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" /> Your Appliances
          </CardTitle>
          {appliances.length > 0 && (
            <CardDescription>
              Estimated daily consumption: <strong>{totalDailyKwh.toFixed(2)} kWh</strong>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : appliances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appliances added yet.</p>
          ) : (
            <div className="space-y-2">
              {appliances.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.type} · {a.watts}W · {a.hoursPerDay} hrs · {a.daysPerMonth >= 30 ? "daily" : a.daysPerMonth >= 12 ? "few times/week" : a.daysPerMonth >= 4 ? "weekly" : "monthly"} · {((a.watts * a.hoursPerDay * a.daysPerMonth) / 30 / 1000).toFixed(2)} kWh/day avg
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(a.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
</Card>

      {/* Predict Bill */}
      {appliances.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Predict My Bill
            </CardTitle>
            <CardDescription>
              Estimate next month's bill based on your registered appliances
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={onPredict} className="w-full gap-2" disabled={predicting}>
              {predicting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              {predicting ? "Calculating..." : "Predict My Bill"}
            </Button>

            {prediction && (
              <div className="space-y-3 pt-2 border-t">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-background border">
                    <p className="text-xs text-muted-foreground">Estimated Units</p>
                    <p className="text-xl font-bold">{prediction.monthlyUnits} kWh</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background border">
                    <p className="text-xs text-muted-foreground">Predicted Bill</p>
                    <p className="text-xl font-bold text-primary">Rs. {prediction.predictedBill.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 px-1">
                  <div className="flex justify-between"><span>Energy Charges</span><span>Rs. {prediction.breakdown.energyCharges.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Meter Rent</span><span>Rs. {prediction.breakdown.meterRent.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>FCA</span><span>Rs. {prediction.breakdown.fca.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>GST</span><span>Rs. {prediction.breakdown.gst.toLocaleString()}</span></div>
                </div>
                <p className="text-[11px] text-muted-foreground italic">
                  This is an estimate based on a 30-day month and the appliances/usage you've entered.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}