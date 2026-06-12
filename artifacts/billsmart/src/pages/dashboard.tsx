import { useLocation } from "wouter";
import { useGetStats, useListBills } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingDown,
  Zap,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  ArrowRight,
  BarChart2,
} from "lucide-react";
import { format } from "date-fns";
import {
  ConsumptionTrendChart,
  AnomalyDetectionChart,
  BillHealthScore,
} from "@/components/BillCharts";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: billsData, isLoading: billsLoading } = useListBills();

  const bills = billsData?.bills ?? [];
  const recentBills = bills.slice(0, 6);
  const isLoading = statsLoading || billsLoading;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Hello, {user?.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor your electricity bills and catch overcharges
          </p>
        </div>
        <Button onClick={() => setLocation("/analyze")} className="gap-2 hidden sm:flex" data-testid="button-analyze">
          <FileSearch className="h-4 w-4" />
          Analyze Bill
        </Button>
      </div>

      {/* Stats grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6 pb-5">
                <div className="h-8 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="stat-total-bills">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
                <BarChart2 className="h-3.5 w-3.5" />
                Total Bills
              </div>
              <p className="text-2xl font-bold">{stats?.totalBills ?? 0}</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-overcharged">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overcharged
              </div>
              <p className="text-2xl font-bold text-destructive">{stats?.overchargedCount ?? 0}</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-total-overcharge">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
                <TrendingDown className="h-3.5 w-3.5" />
                Total Overcharge
              </div>
              <p className="text-2xl font-bold text-destructive">
                Rs. {stats?.totalOvercharge?.toLocaleString() ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="stat-avg-units">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-2">
                <Zap className="h-3.5 w-3.5" />
                Avg. Units
              </div>
              <p className="text-2xl font-bold">{stats?.avgUnits ?? 0} <span className="text-sm font-normal text-muted-foreground">kWh</span></p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics section — only renders if enough bills */}
      {!isLoading && bills.length > 0 && (
        <div className="space-y-4">
          <BillHealthScore bills={bills} />
          <ConsumptionTrendChart bills={bills} />
          <AnomalyDetectionChart bills={bills} />
        </div>
      )}

      {/* Recent bills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Recent Bills</h2>
          {bills.length > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setLocation("/history")}>
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>

        {billsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : bills.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
              <FileSearch className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-medium">No bills yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start by analyzing your first WAPDA / LESCO electricity bill
                </p>
              </div>
              <Button onClick={() => setLocation("/analyze")} className="mt-2" data-testid="button-analyze-first">
                Analyze First Bill
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentBills.map((bill) => (
              <Card key={bill.id} data-testid={`card-bill-${bill.id}`} className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${bill.isOvercharged ? "bg-destructive/10" : "bg-primary/10"}`}>
                      {bill.isOvercharged
                        ? <AlertTriangle className="h-4 w-4 text-destructive" />
                        : <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {bill.billMonth ?? format(new Date(bill.createdAt), "MMM yyyy")}
                        </span>
                        <Badge variant={bill.isOvercharged ? "destructive" : "secondary"} className="text-xs">
                          {bill.isOvercharged ? "Overcharged" : "Correct"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{bill.units} kWh consumed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">Rs. {bill.billedAmount.toLocaleString()}</p>
                      {bill.isOvercharged && (
                        <p className="text-xs text-destructive">+Rs. {bill.difference.toLocaleString()} extra</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Mobile analyze button */}
      <div className="sm:hidden">
        <Button onClick={() => setLocation("/analyze")} className="w-full gap-2" data-testid="button-analyze-mobile">
          <FileSearch className="h-4 w-4" />
          Analyze a Bill
        </Button>
      </div>
    </div>
  );
}
