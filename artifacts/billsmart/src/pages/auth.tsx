import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSignup, useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, AlertCircle } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const loginMutation = useLogin();
  const signupMutation = useSignup();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const signupForm = useForm<SignupForm>({ resolver: zodResolver(signupSchema), defaultValues: { name: "", email: "", password: "" } });

  function onLogin(data: LoginForm) {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          login(res.token, res.user as { id: number; email: string; name?: string | null });
          setLocation("/");
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Login failed";
          toast({ title: "Login failed", description: msg, variant: "destructive" });
        },
      }
    );
  }

  function onSignup(data: SignupForm) {
    signupMutation.mutate(
      { data: { email: data.email, password: data.password, name: data.name || null } },
      {
        onSuccess: (res) => {
          login(res.token, res.user as { id: number; email: string; name?: string | null });
          setLocation("/");
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error ?? "Signup failed";
          toast({ title: "Signup failed", description: msg, variant: "destructive" });
        },
      }
    );
  }
  async function onGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) {
      toast({ title: "Google Sign-In failed", description: "No credential received.", variant: "destructive" });
      return;
    }
    try {
      const resp = await fetch("http://localhost:8080/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        toast({ title: "Google Sign-In failed", description: json.error ?? "Could not sign in.", variant: "destructive" });
        return;
      }
      login(json.token, json.user);
      setLocation("/");
    } catch {
      toast({ title: "Network error", description: "Could not sign in with Google.", variant: "destructive" });
    }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <Zap className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">ZapCheck PK</h1>
          <p className="text-muted-foreground text-sm">
            AI-powered electricity bill analyzer for Pakistani households
          </p>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="pb-4">
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMode("login")}
                data-testid="tab-login"
              >
                Sign In
              </button>
              <button
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                onClick={() => setMode("signup")}
                data-testid="tab-signup"
              >
                Create Account
              </button>
            </div>
            <CardTitle className="text-xl mt-4">{mode === "login" ? "Welcome back" : "Get started"}</CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Sign in to access your bill analysis dashboard"
                : "Create your free account to start analyzing bills"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-4 flex justify-center">
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={() => toast({ title: "Google Sign-In failed", variant: "destructive" })}
              />
            </div>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
            {mode === "login" ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    data-testid="input-email"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    data-testid="input-password"
                    {...loginForm.register("password")}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-signin">
                  {loginMutation.isPending ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Name (optional)</Label>
                  <Input
                    id="signup-name"
                    placeholder="Your name"
                    data-testid="input-name"
                    {...signupForm.register("name")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    data-testid="input-signup-email"
                    {...signupForm.register("email")}
                  />
                  {signupForm.formState.errors.email && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {signupForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Min. 6 characters"
                    data-testid="input-signup-password"
                    {...signupForm.register("password")}
                  />
                  {signupForm.formState.errors.password && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {signupForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={signupMutation.isPending} data-testid="button-signup">
                  {signupMutation.isPending ? "Creating account…" : "Create Account"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by Groq AI · NEPRA 2025 tariffs · 100% free
        </p>
      </div>
    </div>
  );
}
