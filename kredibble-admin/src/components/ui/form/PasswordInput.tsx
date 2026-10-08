"use client";

/**
 * PasswordInput: a password field with the show/hide eye button, the one the Login page has (it now uses this component).
 *
 * The field is type="password" until the eye is pressed (type="text" while shown). The button is 40px, named "Show password" or
 * "Hide password" (a different word for each field through `label`, so a page with three of them has three distinct buttons) and
 * has aria-pressed. The field is hidden again when the tab is hidden (visibilitychange) and when the field is removed, so a shown
 * password is never left on screen. It never stores or logs the value: the parent owns it.
 * Use it inside a <Field> (the label, helper and error come from there).
 *
 * Props: value, onChange(value), autoComplete ("current-password" or "new-password"), placeholder?, label? (the noun in the button's
 * name: "Show current password"), disabled?, onBlur?, id? (when not inside a Field), testId?
 */
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./Input";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  onBlur?: () => void;
  testId?: string;
}

export function PasswordInput({ value, onChange, autoComplete, placeholder, label = "password", disabled, onBlur, testId }: PasswordInputProps) {
  const [shown, setShown] = useState(false);

  // A shown password is hidden again when the tab goes to the background.
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") setShown(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);

  return (
    <div className="relative">
      <Input
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        className="pr-11"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setShown((current) => !current)}
        aria-label={shown ? `Hide ${label}` : `Show ${label}`}
        aria-pressed={shown}
        className="absolute right-0 top-0 inline-flex size-10 items-center justify-center rounded-inset text-muted transition-colors hover:bg-neutral-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {shown ? <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.75} aria-hidden="true" />}
      </button>
    </div>
  );
}
