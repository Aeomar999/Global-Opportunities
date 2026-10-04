/**
 * Button: the one button style for the admin. 40px tall, 12px radius,
 * Inter 600 14/20.
 *
 * Props:
 * - variant: primary (orange-600 fill, white label) | secondary (white with a
 *   border) | ghost (transparent) | danger (red tint) | danger-solid (solid red,
 *   for confirming a destructive action)
 * - size: "md" (40px, default) or "sm" (36px, for table footers and toolbars)
 * - onDark: restyle for dark surfaces such as the sidebar (ghost / secondary
 *   become translucent white with light text)
 * - loading: shows a spinner, sets aria-busy and disables the button
 * - icon: optional lucide icon shown before the label
 * - ...rest: any native <button> attribute
 *
 * `buttonClasses(variant, onDark)` is exported so a Next <Link> can look like a
 * button without nesting a <button> inside an <a>.
 *
 * Disabled buttons are clearly muted (grey fill, muted text), not just faded.
 * Primary: white on orange-600 is 4.6:1 (hover orange-hover is 5.5:1).
 */
import type { ButtonHTMLAttributes, Ref } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-orange-600 text-white hover:bg-orange-hover disabled:bg-neutral-soft disabled:text-muted",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-2 disabled:bg-neutral-soft disabled:text-muted disabled:border-line",
  ghost: "bg-transparent text-ink hover:bg-neutral-soft disabled:text-muted",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white disabled:bg-neutral-soft disabled:text-muted",
  // The confirm button of a destructive dialog: solid red (never orange), white label 6.5:1.
  "danger-solid": "bg-danger text-white hover:bg-ink disabled:bg-neutral-soft disabled:text-muted",
};

// On dark surfaces: translucent fills and light text (sb-text 16.8:1 on sb-bg).
const DARK_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-orange-600 text-white hover:bg-orange-hover disabled:bg-white/10 disabled:text-sb-muted",
  secondary: "bg-white/10 text-sb-text border border-white/10 hover:bg-white/15 disabled:text-sb-muted",
  ghost: "bg-transparent text-sb-text hover:bg-white/10 disabled:text-sb-muted",
  danger: "bg-danger-soft text-danger hover:bg-danger hover:text-white disabled:bg-white/10 disabled:text-sb-muted",
  "danger-solid": "bg-danger text-white hover:bg-white hover:text-danger disabled:bg-white/10 disabled:text-sb-muted",
};

export type ButtonSize = "md" | "sm";

export const buttonClasses = (variant: ButtonVariant = "primary", onDark = false, size: ButtonSize = "md") =>
  cn(
    "button-text inline-flex items-center justify-center gap-2 rounded-control",
    size === "sm" ? "h-9 px-3" : "h-10 px-4",
    "transition-colors duration-150 ease-out disabled:cursor-not-allowed",
    (onDark ? DARK_VARIANTS : VARIANTS)[variant],
  );

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  onDark?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  /** React 19 passes ref as a normal prop; used by dialogs to focus a button. */
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "primary",
  size = "md",
  onDark = false,
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, onDark, size), className)}
      {...rest}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
