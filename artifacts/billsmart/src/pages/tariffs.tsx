import { useGetTariffs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Info } from "lucide-react";

export default function TariffsPage() {
  const { data, isLoading } = useGetTariffs();

  const slabs = data?.slabs ?? [];
  const charges = data?.charges ?? {};

  const maxRate = slabs.length > 0 ? Math.max(...slabs.map((s) => s.rate)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">NEPRA Tariff Rates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Current electricity tariff slabs and fixed charges used for bill analysis
        </p>
      </div>

      <div className="flex items-start gap-2 p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-medium">Progressive tariff system:</span> Pakistan uses a slab-based system. You pay the higher rate only for units in that slab, not all units. The calculator uses these exact NEPRA-approved rates.
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Tariff slabs */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Energy Tariff Slabs (Rs./kWh)
              </CardTitle>
              <CardDescription>NEPRA 2026 approved tariff slabs for domestic consumers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {slabs.map((slab, i) => (
                <div key={i} data-testid={`slab-${i}`} className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <p className="text-xs text-muted-foreground">{slab.label}</p>
                    <p className="text-xs text-muted-foreground">{slab.min}–{slab.max === 99999 ? "∞" : slab.max} units</p>
                  </div>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(slab.rate / maxRate) * 100}%` }}
                    />
                  </div>
                  <Badge variant="outline" className="shrink-0 font-mono text-xs w-20 justify-center">
                    Rs. {slab.rate}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Fixed charges */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fixed Charges</CardTitle>
              <CardDescription>Additional charges applied to every bill</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Object.entries(charges).map(([name, value]) => (
                  <div key={name} className="p-4 rounded-lg border border-border bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                      {name.replace(/_/g, " ")}
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {name === "gst_percent" ? `${value}%` : `Rs. ${value}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {name === "meter_rent" && "per month"}
                      {name === "gst_percent" && "of bill total"}
                      {name === "fca_per_unit" && "per kWh"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="text-xs text-muted-foreground text-center">
            Tariff data based on NEPRA's approved domestic consumer rates effective 2026
          </div>
        </>
      )}
    </div>
  );
}
