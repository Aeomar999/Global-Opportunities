/**
 * /_design: dev-only component review page.
 * Renders every shared UI component in every state, once on the page
 * background and once on the dark sidebar background. Returns a 404 in
 * production builds.
 *
 * The folder is named `%5Fdesign` because a plain `_design` folder is a
 * private folder in the App Router (not routable); `%5F` is an encoded
 * underscore that makes the URL segment "_design".
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignGallery } from "./DesignGallery";

export const metadata: Metadata = {
  title: "Design review",
  robots: { index: false, follow: false },
};

// Evaluate NODE_ENV per request instead of freezing the result at build time.
export const dynamic = "force-dynamic";

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignGallery />;
}
