import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function assertSubmissionsAllowed(
  supabase: SupabaseClient,
): Promise<{ allowed: boolean; message?: string }> {
  const { data: control } = await supabase
    .from("system_controls")
    .select("value")
    .eq("key", "submissions_enabled")
    .maybeSingle();

  const enabled = (control?.value as { enabled?: boolean } | null)?.enabled ?? true;
  if (!enabled) {
    return {
      allowed: false,
      message: "New submissions are temporarily paused for campus capacity maintenance.",
    };
  }

  const { data: health } = await supabase.rpc("get_database_health");
  const tier = (health as { tier?: string } | null)?.tier;
  if (tier === "hard_pause") {
    return {
      allowed: false,
      message: "Platform is in temporary read-only mode to protect database capacity.",
    };
  }

  return { allowed: true };
}
