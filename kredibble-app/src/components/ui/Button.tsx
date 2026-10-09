import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps, View } from "react-native";
import { tv, type VariantProps } from "tailwind-variants";
import { Colors } from "../../constants/design";

/**
 * Button. Radius 12 (rounded-control) and height 48 (h-control) for every size; sizes only change padding and text size.
 * Variants: primary (purple), accent (filled orange: accent-600 with a white label, 4.61:1), secondary, outline, ghost.
 * Never put a white label on orange-500 (#FC5E24, 3.10:1).
 */

const buttonVariants = tv({
  base: "flex flex-row items-center justify-center rounded-control active:opacity-80",
  variants: {
    variant: {
      primary: "bg-primary",
      accent: "bg-accent-600",
      secondary: "bg-background-alt",
      outline: "border border-border-input bg-transparent",
      ghost: "bg-transparent",
    },
    size: {
      sm: "h-control px-4",
      md: "h-control px-6",
      lg: "h-control px-8",
    },
    disabled: {
      true: "opacity-50",
    },
    fullWidth: {
      true: "w-full",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
    fullWidth: false,
    disabled: false,
  },
});

const textVariants = tv({
  base: "font-sans font-semibold text-center",
  variants: {
    variant: {
      primary: "text-white",
      accent: "text-white",
      secondary: "text-text",
      outline: "text-text",
      ghost: "text-primary",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export interface ButtonProps
  extends TouchableOpacityProps,
    VariantProps<typeof buttonVariants> {
  label: string;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  label,
  variant,
  size,
  fullWidth,
  disabled,
  loading,
  icon,
  className,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={buttonVariants({ variant, size, fullWidth, disabled: isDisabled, className })}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "accent" ? Colors.white : Colors.primary} />
      ) : (
        <View className="flex-row items-center space-x-2">
          {icon}
          <Text className={textVariants({ variant, size })}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
