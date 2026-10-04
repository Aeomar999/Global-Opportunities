"use client";

/**
 * Textarea: a multi-line text control. Put it inside a <Field>.
 *
 * Props: any native <textarea> attribute. `rows` sets the starting height; the user can resize
 * it vertically. Text is 14/20 like Input, with 10px vertical padding.
 */
import type { Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASSES, useFieldControlProps } from "./Field";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, rows = 4, ...rest }: TextareaProps) {
  const fieldProps = useFieldControlProps();
  return <textarea {...fieldProps} rows={rows} {...rest} className={cn(CONTROL_CLASSES, "resize-y py-2.5", className)} />;
}
