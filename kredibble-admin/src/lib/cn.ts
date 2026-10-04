import clsx, { type ClassValue } from "clsx";

/**
 * Joins class names, skipping falsy values. Thin wrapper over `clsx`
 * (already a dependency) so call sites read `cn(...)`.
 */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);
