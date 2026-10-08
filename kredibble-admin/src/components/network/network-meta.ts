/**
 * Words used by the Network and the Leaderboard: the channel names (the social platforms an ambassador shares on).
 * Tier, member type and status words live with their types in lib/mock-entities.ts and lib/status-map.ts.
 */
import type { SocialPlatform } from "@/lib/mock-entities";

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  facebook: "Facebook",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};
