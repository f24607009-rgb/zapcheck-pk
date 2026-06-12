import { useListBills, useGetChatHistory } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle2, MessageSquare, FileText, Clock } from "lucide-react";
import { format } from "date-fns";
import { BillComparisonView, type BillRecord } from "@/components/BillCharts";

export default function HistoryPage() {
  const { data: billsData, isLoading: billsLoading } = useListBills();
  const { data: chatData, isLoading: chatLoading } = useGetChatHistory();

  const bills: BillRecord[] = billsData?.bills ?? [];
  const logs = chatData?.logs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-sm text-muted-foreground mt-1">Your bill analyses and chatbot conversations</p>
      </div>

      <Tabs defaultValue="bills">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="bills" data-testid="tab-bills">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Bills ({bills.length})
          </TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat">
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Chats ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Bills tab ── */}
        <TabsContent value="bills" className="mt-4 space-y-4">

          {/* Bill Comparison — only shown with ≥2 bills */}
          {!billsLoading && bills.length >= 2 && (
            <BillComparisonView bills={bills} />
          )}

          {billsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : bills.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium">No bills analyzed yet</p>
                <p className="text-sm text-muted-foreground mt-1">Your saved bill analyses will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <Card key={bill.id} data-testid={`history-bill-${bill.id}`} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${bill.isOvercharged ? "bg-destructive/10" : "bg-primary/10"}`}>
                          {bill.isOvercharged
                            ? <AlertTriangle className="h-4 w-4 text-destructive" />
                            : <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {bill.billMonth ?? format(new Date(bill.createdAt), "MMMM yyyy")}
                            </span>
                            <Badge variant={bill.isOvercharged ? "destructive" : "secondary"} className="text-xs">
                              {bill.isOvercharged ? "Overcharged" : "Correct"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {bill.units} kWh · Saved {format(new Date(bill.createdAt), "dd MMM yyyy")}
                          </p>
                          {(bill as unknown as { slabBreakdown?: Array<{ label: string }> }).slabBreakdown?.length ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              {(bill as unknown as { slabBreakdown: Array<{ label: string }> }).slabBreakdown.map((s) => s.label).join(" → ")}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">Rs. {bill.billedAmount.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Expected: Rs. {bill.expectedAmount.toLocaleString()}</p>
                        {bill.isOvercharged && (
                          <p className="text-xs text-destructive font-medium mt-0.5">+Rs. {bill.difference.toLocaleString()}</p>
                        )}
                      </div>
                    </div>

                    {/* Charge chips */}
                    {(bill.energyCharges != null || bill.meterRent != null) && (
                      <div className="mt-3 pt-3 border-t border-border grid grid-cols-4 gap-2">
                        {bill.energyCharges != null && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Energy</p>
                            <p className="text-xs font-medium">Rs. {bill.energyCharges.toLocaleString()}</p>
                          </div>
                        )}
                        {bill.meterRent != null && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Meter Rent</p>
                            <p className="text-xs font-medium">Rs. {bill.meterRent}</p>
                          </div>
                        )}
                        {bill.fca != null && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">FCA</p>
                            <p className="text-xs font-medium">Rs. {bill.fca.toLocaleString()}</p>
                          </div>
                        )}
                        {bill.gst != null && (
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">GST</p>
                            <p className="text-xs font-medium">Rs. {bill.gst.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Chat tab ── */}
        <TabsContent value="chat" className="mt-4">
          {chatLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="font-medium">No chat history yet</p>
                <p className="text-sm text-muted-foreground mt-1">Your conversations with the AI assistant will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <Card key={log.id} data-testid={`history-chat-${log.id}`}>
                  <CardContent className="py-4 px-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={log.status === "escalated" ? "destructive" : "secondary"} className="text-xs capitalize">
                        {log.status}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.createdAt), "dd MMM, h:mm a")}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">You asked:</p>
                        <p className="text-sm">{log.userMessage}</p>
                      </div>
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                        <p className="text-xs font-medium text-primary mb-1">AI Response:</p>
                        <p className="text-sm whitespace-pre-wrap">{log.botResponse}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
