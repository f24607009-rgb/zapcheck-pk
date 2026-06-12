import { useState, useRef, useEffect } from "react";
import { useSendChat, useListBills, getListBillsQueryKey, getGetChatHistoryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, X, Send, Bot, User, Loader2, Minimize2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  status?: string;
};

const WELCOME = "Hi! I'm your BillSmart AI assistant. I can help you understand your electricity bills, explain NEPRA charges, and answer questions about your usage. What would you like to know?";

export default function ChatbotWidget() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "bot", text: WELCOME },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const sendMutation = useSendChat();
  const { data: billsData } = useListBills({ query: { enabled: isAuthenticated, queryKey: getListBillsQueryKey() } });

  // Get the most recent bill for context
  const latestBill = billsData?.bills?.[0];
  const billContext = latestBill
    ? {
        units: latestBill.units,
        billedAmount: latestBill.billedAmount,
        expectedAmount: latestBill.expectedAmount,
        isOvercharged: latestBill.isOvercharged,
        difference: latestBill.difference,
        energyCharges: latestBill.energyCharges,
        meterRent: latestBill.meterRent,
        fca: latestBill.fca,
        gst: latestBill.gst,
        slabBreakdown: latestBill.slabBreakdown as Array<{ label: string; units: number; rate: number; charge: number }> | undefined,
      }
    : null;

  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      inputRef.current?.focus();
    }
  }, [open, messages]);

  function sendMessage() {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    sendMutation.mutate(
      { data: { message: text, billContext: billContext as Record<string, unknown> | null } },
      {
        onSuccess: (res) => {
          setMessages((prev) => [
            ...prev,
            { id: `b-${Date.now()}`, role: "bot", text: res.response, status: res.status },
          ]);
          qc.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: "bot", text: "Sorry, I'm having trouble connecting right now. Please try again shortly.", status: "error" },
          ]);
        },
      }
    );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (!isAuthenticated) return null;

  const unreadCount = 0;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat window */}
      {open && (
        <div className="w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "480px" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground">
            <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">BillSmart AI</p>
              <p className="text-xs opacity-80">Ask about your electricity bills</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20 shrink-0"
              onClick={() => setOpen(false)}
              data-testid="button-close-chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Bill context indicator */}
          {latestBill && (
            <div className={`px-3 py-1.5 text-xs flex items-center gap-2 border-b border-border ${latestBill.isOvercharged ? "bg-destructive/5 text-destructive" : "bg-primary/5 text-primary"}`}>
              {latestBill.isOvercharged ? <AlertTriangle className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
              <span>Context: {latestBill.units} kWh bill · {latestBill.isOvercharged ? "Overcharged" : "Correct"}</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {msg.role === "user"
                    ? <User className="h-3 w-3" />
                    : <Bot className="h-3 w-3 text-muted-foreground" />}
                </div>
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted text-foreground rounded-tl-sm"
                )}>
                  {msg.text}
                  {msg.status === "escalated" && (
                    <Badge variant="outline" className="mt-1 text-xs">Escalated</Badge>
                  )}
                </div>
              </div>
            ))}
            {sendMutation.isPending && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Bot className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask about your bill…"
              className="flex-1 text-sm h-9"
              disabled={sendMutation.isPending}
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() || sendMutation.isPending}
              data-testid="button-send-chat"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        data-testid="button-toggle-chat"
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors hover:scale-105 active:scale-95 transition-transform"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}
      >
        {open
          ? <Minimize2 className="h-6 w-6" />
          : <MessageSquare className="h-6 w-6" />}
      </button>
    </div>
  );
}
