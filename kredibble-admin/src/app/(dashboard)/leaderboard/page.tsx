"use client";

/**
 * Leaderboard (/leaderboard): placeholder, built in a later step. It is already in the nav and guarded by the
 * "leaderboard" screen (src/config/permissions.ts).
 */
import { Trophy } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function LeaderboardPage() {
  return <StubPage screen="leaderboard" title="Leaderboard" subtitle="How ambassadors and countries compare." icon={Trophy} tone="neutral" />;
}
