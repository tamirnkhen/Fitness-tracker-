import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, requireServerEnv } from "@/lib/env";

/**
 * Service-role client: bypasses RLS. Only use it AFTER verifying who the caller is
 * (requireUser / requireAdmin), and always scope queries by that verified user id.
 */
export function createServiceClient() {
  return createClient(SUPABASE_URL, requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
