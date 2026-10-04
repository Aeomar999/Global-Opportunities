"use client";

/**
 * Testimonials (/testimonials): placeholder, built in a later step. It is already in the nav and guarded by the
 * "testimonials" screen (src/config/permissions.ts).
 */
import { Quote } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function TestimonialsPage() {
  return <StubPage screen="testimonials" title="Testimonials" subtitle="Stories from seekers, hirers and partners." icon={Quote} tone="neutral" />;
}
