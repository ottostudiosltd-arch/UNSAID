import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { errorResponse, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabaseAdmin.ts";
import {
  checkRateLimit,
  extractSessionId,
  hashCollegeCode,
  hashIpSignal,
  hashSessionId,
  moderateText,
  parseJsonBody,
  sha256Hex,
  signCollegeToken,
} from "../_shared/security.ts";

interface VerifyCollegeBody {
  action?: "verify" | "list" | "register";
  code?: string;
  name?: string;
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function makeCollegeSlug(name: string, code: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const codePart = code.toLowerCase().replace(/[^a-z0-9-]+/g, "");
  return `${base || "campus"}-${codePart || "clg"}`;
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

  const body = (await parseJsonBody<VerifyCollegeBody>(req, 2048)) ?? {};
  const action = body.action ?? "verify";

  try {
    const supabase = getServiceClient();
    const sessionHash = await hashSessionId(sessionId);
    const ipHash = await hashIpSignal(req);

    // 1. List active colleges (code + name)
    if (action === "list") {
      const ipRate = await checkRateLimit(supabase, `list_clg:ip:${ipHash}`, 60, 5 * 60);
      if (!ipRate.allowed) {
        return errorResponse(req, "RATE_LIMITED", "Too many requests. Try again shortly.", 429);
      }

      const { data: rows, error } = await supabase
        .from("colleges")
        .select("code, name, short_name, slug")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (error) {
        return errorResponse(req, "LIST_FAILED", "Could not load colleges list.", 500);
      }

      const colleges = (rows ?? [])
        .filter((r) => Boolean(r.code))
        .map((r) => ({
          code: r.code as string,
          name: r.name,
          shortName: r.short_name ?? r.name,
          slug: r.slug,
        }));

      return jsonResponse(req, { colleges });
    }

    // 2. Register a new college (only 2 inputs: name & code)
    if (action === "register") {
      const rawName = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      const rawCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";

      if (rawName.length < 3 || rawName.length > 100) {
        return errorResponse(
          req,
          "INVALID_NAME",
          "College name must be between 3 and 100 characters.",
          400,
        );
      }
      if (rawCode.length < 3 || rawCode.length > 12 || !/^[A-Z0-9-]+$/.test(rawCode)) {
        return errorResponse(
          req,
          "INVALID_CODE",
          "College code must be 3 to 12 letters or numbers.",
          400,
        );
      }

      const nameMod = moderateText(rawName, { isShortLabel: true });
      if (nameMod.decision !== "approved") {
        return errorResponse(
          req,
          "INVALID_NAME",
          nameMod.reason ?? "Please enter a respectful official college name.",
          422,
        );
      }

      // Disallow colliding with admin gate code
      const adminGateHash = Deno.env.get("ADMIN_GATE_HASH")?.trim().toLowerCase() ?? "";
      if (adminGateHash.length === 64) {
        const candidateAdminHash = await sha256Hex(`admin_gate:${rawCode}`);
        if (timingSafeHexEqual(candidateAdminHash, adminGateHash)) {
          return errorResponse(req, "INVALID_CODE", "That code is reserved. Choose another code.", 400);
        }
      }

      const [sessLimit, ipLimit] = await Promise.all([
        checkRateLimit(supabase, `reg_clg:sess:${sessionHash}`, 3, 60 * 60),
        checkRateLimit(supabase, `reg_clg:ip:${ipHash}`, 8, 60 * 60),
      ]);
      if (!sessLimit.allowed || !ipLimit.allowed) {
        return errorResponse(
          req,
          "RATE_LIMITED",
          "Too many college additions right now. Please try again later.",
          429,
        );
      }

      const codeHash = await hashCollegeCode(rawCode);
      const { data: existingByCode } = await supabase
        .from("colleges")
        .select("id, code, name")
        .or(`code.eq.${rawCode},code_hash.eq.${codeHash}`)
        .limit(1)
        .maybeSingle();

      if (existingByCode) {
        return errorResponse(
          req,
          "COLLEGE_EXISTS",
          `Code ${rawCode} is already registered (${existingByCode.name}). Select it from the dropdown or enter the code.`,
          409,
        );
      }

      const shortName = rawName.length <= 28 ? rawName : rawName.slice(0, 28).trim();
      const baseSlug = makeCollegeSlug(rawName, rawCode);
      const uniqueSlug = baseSlug;

      const { data: created, error: insertError } = await supabase
        .from("colleges")
        .insert({
          code: rawCode,
          name: rawName,
          short_name: shortName,
          slug: uniqueSlug,
          code_hash: codeHash,
          is_active: true,
        })
        .select("id, code, name, short_name, slug")
        .single();

      if (insertError || !created) {
        return errorResponse(
          req,
          "REGISTER_FAILED",
          "Could not add college. Please check the name & code and try again.",
          500,
        );
      }

      const collegeCode = created.code ?? rawCode;
      const resolvedShortName = created.short_name ?? created.name;
      const ttlSeconds = 60 * 60 * 12;
      const token = await signCollegeToken(
        {
          collegeId: created.id,
          collegeCode,
          collegeName: created.name,
          collegeShortName: resolvedShortName,
          sessionHash,
        },
        ttlSeconds,
      );

      return jsonResponse(
        req,
        {
          mode: "college",
          token,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
          college: {
            id: created.id,
            code: collegeCode,
            name: created.name,
            shortName: resolvedShortName,
            slug: created.slug,
          },
        },
        201,
      );
    }

    // 3. Default verify college code / secret admin gate
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";
    if (rawCode.length < 3 || rawCode.length > 32) {
      return errorResponse(req, "INVALID_CODE_FORMAT", "Please enter a valid college code.", 400);
    }

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
