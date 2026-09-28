"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { loginAdmin } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = email.trim().length > 0 && password.trim().length > 0 && !isSubmitting;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setError("");
    setIsSubmitting(true);
    try {
      await loginAdmin(email.trim(), password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="Kredibble" width={56} height={56} className="rounded-2xl mb-4" />
          <h1 className="text-2xl font-bold text-kb-text-body">Kredibble Admin</h1>
          <p className="text-sm text-kb-text-muted mt-1">Sign in to manage the platform</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-kb-bg-card border border-kb-border rounded-2xl p-6 shadow-sm"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-kb-text-body mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@kredibble.com"
              className="w-full h-11 rounded-lg border border-kb-border-input px-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-kb-text-body mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-11 rounded-lg border border-kb-border-input px-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-kb-error/20 bg-kb-error/10 px-3 py-2 text-sm text-kb-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid}
            className="w-full h-11 rounded-lg bg-kb-primary text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          <p className="mt-4 text-center text-sm text-kb-text-muted">
            Need an admin account? Ask an existing administrator to provision one
            server-side with{" "}
            <code className="rounded bg-kb-bg-muted px-1 py-0.5 text-xs">
              npm run user:create-admin
            </code>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
