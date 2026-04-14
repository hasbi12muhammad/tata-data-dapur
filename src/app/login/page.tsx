"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn(email, password);
    setLoading(false);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#1E3A5F] flex items-center justify-center mb-3">
            <div className="w-6 h-6 rounded bg-[#059669] flex items-center justify-center">
              <span className="text-white text-xs font-bold">C</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Costify</h1>
          <p className="text-sm text-slate-500 mt-1">HPP & cost management</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-5">
            Sign in to your account
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <Button
              type="submit"
              loading={loading}
              size="lg"
              className="mt-1 w-full"
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Costify &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
