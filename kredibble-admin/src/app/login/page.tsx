"use client";

/**
 * Admin sign-in.
 *
 * Layout
 * - 1024px and up: split screen. Left, the dark violet gradient (the sidebar colours) with the brand mark,
 *   one value line and a soft orange glow at the bottom. Right, the form card.
 * - Below 1024px: only the form card, centred, with the brand mark above it.
 *
 * Behaviour (unchanged): POST /auth/admin/login through loginAdmin() (src/lib/api.ts), which also checks the
 * admin role and throws the server's message for every error path (wrong credentials, non-admin role, rate
 * limit, lockout, network). The message is shown in the banner below.
 * Added: show/hide password button, a spinner on Sign in while the request runs, an error banner that is
 * announced (role="alert"), and focus on the email field when the page opens.
 * There is no signup: access is by invitation only.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { BRAND, BRAND_ADMIN_TITLE } from "@/config/brand";
import { BrandMark } from "@/components/BrandMark";
import { loginAdmin } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { PasswordInput } from "@/components/ui/form/PasswordInput";

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
    <div className="flex flex-1 lg:grid lg:grid-cols-2">
      {/* Brand panel: 1024px and up only */}
      <aside className="dark-feature dark-surface relative hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <div>
            <p className="brand-name text-sb-text">{BRAND.name}</p>
            <p className="brand-sub">{BRAND.sub}</p>
          </div>
        </div>
        <div className="max-w-md pb-12">
          <p className="hero-title text-sb-text">Keep every opportunity on the platform trusted.</p>
          <p className="body-sm mt-4 text-sb-muted">Review verifications, moderate postings and look after your community from one desk.</p>
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <BrandMark size={56} className="mb-4 lg:hidden" />
            <h1 data-testid="page-title" className="page-title">{BRAND_ADMIN_TITLE}</h1>
            <p className="page-subtitle mt-1">{BRAND.sub}: sign in to manage the platform</p>
          </div>

          <form onSubmit={handleLogin} noValidate className="card-surface space-y-4 p-6">
            <Field label="Email">
              <Input
                type="email"
                autoFocus
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </Field>

            <Field label="Password">
              <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" placeholder="Enter your password" />
            </Field>

            {error && (
              <p role="alert" className="body-sm flex items-start gap-2 rounded-control border border-danger/25 bg-danger-soft px-3 py-2 text-danger">
                <AlertCircle size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <Button type="submit" loading={isSubmitting} disabled={!isValid} className="w-full">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>

            <p className="caption flex items-center justify-center gap-1.5 text-center">
              <ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true" />
              Access is by invitation only.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
