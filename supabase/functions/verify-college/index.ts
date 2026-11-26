import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabaseAdmin.ts";
import {
  checkRateLimit,
  extractSessionId,
  hashCollegeCode,
  hashIpSignal,
  hashSessionId,
  parseJsonBody,
  sha256Hex,
  signCollegeToken,
} from "../_shared/security.ts";

interface VerifyCollegeBody {
  code?: string;
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  if (req.method !== "POST") {
    return errorResponse(req, "METHOD_NOT_ALLOWED", "Only POST is allowed.", 405);
  }

  const sessionId = extractSessionId(req);
  if (!sessionId) {
    return errorResponse(req, "INVALID_SESSION", "Valid anonymous session ID is required.", 400);
  }

  const body = await parseJsonBody<VerifyCollegeBody>(req, 1024);
  const rawCode = typeof body?.code === "string" ? body.code.trim() : "";
  if (rawCode.length < 3 || rawCode.length > 32) {
    return errorResponse(req, "INVALID_CODE_FORMAT", "Please enter a valid college code.", 400);
  }

  try {
    const supabase = getServiceClient();
    const sessionHash = await hashSessionId(sessionId);
    const ipHash = await hashIpSignal(req);

    const [sessLimit, ipLimit] = await Promise.all([
      checkRateLimit(supabase, `verify:sess:${sessionHash}`, 5, 15 * 60),
      checkRateLimit(supabase, `verify:ip:${ipHash}`, 15, 15 * 60),
    ]);

    if (!sessLimit.allowed || !ipLimit.allowed) {
      return errorResponse(
        req,
        "RATE_LIMITED",
        "Too many code attempts. Please wait 15 minutes and try again.",
        429,
      );
    }

    // Check secret server-side Admin Gate hash (never stored in frontend)
    const adminGateHash = Deno.env.get("ADMIN_GATE_HASH")?.trim().toLowerCase() ?? "";
    if (adminGateHash.length === 64) {
      const candidateAdminHash = await sha256Hex(`admin_gate:${rawCode.toUpperCase()}`);
      if (timingSafeHexEqual(candidateAdminHash, adminGateHash)) {
        return jsonResponse(req, {
          mode: "admin_gate",
        });
      }
    }

    const codeHash = await hashCollegeCode(rawCode);
    const { data: college, error } = await supabase
      .from("colleges")
      .select("id, code, name, short_name, slug, is_active")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (error) {
      return errorResponse(req, "VERIFICATION_FAILED", "Could not verify college code.", 500);
    }

    if (!college || !college.is_active) {
      return errorResponse(req, "INVALID_COLLEGE_CODE", "College code not recognized or inactive.", 401);
    }

    const collegeCode = college.code ?? rawCode.toUpperCase();
    const shortName = college.short_name ?? college.name;

    const ttlSeconds = 60 * 60 * 12; // 12h
    const token = await signCollegeToken(
      {
        collegeId: college.id,
        collegeCode,
        collegeName: college.name,
        collegeShortName: shortName,
        sessionHash,
      },
      ttlSeconds,
    );

    return jsonResponse(req, {
      mode: "college",
      token,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      college: {
        id: college.id,
        code: collegeCode,
        name: college.name,
        shortName,
        slug: college.slug,
      },
    });
  } catch {
    return errorResponse(req, "SERVER_ERROR", "Unable to verify college code right now.", 500);
  }
});
