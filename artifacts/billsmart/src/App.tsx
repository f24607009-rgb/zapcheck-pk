import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import AnalyzePage from "@/pages/analyze";
import AnalysisPage from "@/pages/analysis";
import MeterPage from "@/pages/meter";
import HistoryPage from "@/pages/history";
import TariffsPage from "@/pages/tariffs";
import AppliancesPage from "@/pages/appliances";
import ChatbotWidget from "@/components/ChatbotWidget";
import Layout from "@/components/Layout";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = "270019963916-csmmmja00gcjbe45dpvbok081kkjhhn9.apps.googleusercontent.com";

setBaseUrl("http://localhost:8080");
setAuthTokenGetter(() => localStorage.getItem("bs_token"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AppRoutes() {
  return (
    <>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/">
          <Layout><DashboardPage /></Layout>
        </Route>
        <Route path="/analyze">
          <Layout><AnalyzePage /></Layout>
        </Route>
        <Route path="/analysis">
          <Layout><AnalysisPage /></Layout>
        </Route>
        <Route path="/history">
          <Layout><HistoryPage /></Layout>
        </Route>
        <Route path="/tariffs">
          <Layout><TariffsPage /></Layout>
        </Route>
        <Route path="/appliances">
          <Layout><AppliancesPage /></Layout>
        </Route>
        <Route path="/meter">
        <Layout><MeterPage /></Layout>
        </Route>
        <Route component={NotFound} />
      </Switch>
      <ChatbotWidget />
    </>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

export default App;