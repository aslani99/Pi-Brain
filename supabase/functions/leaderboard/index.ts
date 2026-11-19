import { handleOptions, json } from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

// Public, read-only Top 10. Only verified Pi profiles are inserted by
// the server's authentication flow. Never return Pi UID, profile ID, or email.
Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;

  try {
    const admin = getAdminClient();
    // Both queries are read-only. The count is taken from verified Pi profiles,
    // never from anonymous website traffic or a placeholder number.
    const [leaders, participants] = await Promise.all([
      admin.from("profiles")
        .select("id,username,total_xp,total_correct,created_at")
        .order("total_xp", { ascending: false })
        .order("total_correct", { ascending: false })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(10),
      admin.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    if (leaders.error) throw leaders.error;
    if (participants.error || participants.count === null) throw participants.error ?? new Error("Profile count unavailable");

    return json(req, {
      participant_count: participants.count,
      entries: (leaders.data ?? []).map((item, index) => ({
        rank: index + 1,
        username: item.username,
        total_xp: item.total_xp,
      })),
    });
  } catch {
    return json(req, { error: "Could not load leaderboard." }, 500);
  }
});
