"use client";

/**
 * Input: a single-line text control (40px tall). Put it inside a <Field>.
 *
 * Props: any native <input> attribute, plus
 * - large: the article-title size (Jakarta 20/28 text, 52px tall)
 * - onBlur: forward it to mark the field as touched (see useTouched)
 */
import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASSES, useFieldControlProps } from "./Field";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  large?: boolean;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ large = false, className, ...rest }: InputProps) {
  const fieldProps = useFieldControlProps();
  return (
    <input
      {...fieldProps}
      {...rest}
      className={cn(CONTROL_CLASSES, large ? "form-title-text h-13" : "h-10", className)}
    />
  );
}
