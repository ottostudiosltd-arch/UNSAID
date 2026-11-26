import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface CollegeTokenPayload {
  collegeId: string;
  collegeCode: string;
  collegeName: string;
  collegeShortName: string;
  sessionHash: string;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getTokenSecret(): string {
  const secret = Deno.env.get("COLLEGE_TOKEN_SECRET");
  if (!secret || secret.length < 16) {
    throw new Error("Missing or weak COLLEGE_TOKEN_SECRET");
  }
  return secret;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signCollegeToken(
  payload: Omit<CollegeTokenPayload, "iat" | "exp">,
  ttlSeconds = 60 * 60 * 12, // 12 hours short-lived token
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: CollegeTokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const payloadPart = toBase64Url(encoder.encode(JSON.stringify(fullPayload)));
  const key = await importHmacKey(getTokenSecret());
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart)),
  );
  return `${payloadPart}.${toBase64Url(sig)}`;
}

export async function verifyCollegeToken(
  token: string | null,
  expectedSessionHash: string,
): Promise<CollegeTokenPayload | null> {
  if (!token || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadPart, sigPart] = parts;

  try {
    const key = await importHmacKey(getTokenSecret());
    const expectedSig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(payloadPart)),
    );
    const actualSig = fromBase64Url(sigPart);
    if (!timingSafeEqual(expectedSig, actualSig)) return null;

    const decoded = JSON.parse(
      new TextDecoder().decode(fromBase64Url(payloadPart)),
    ) as CollegeTokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (!decoded.collegeId || !decoded.sessionHash || decoded.exp < now) {
      return null;
    }
    if (decoded.sessionHash !== expectedSessionHash) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function extractSessionId(req: Request): string | null {
  const sessionId = req.headers.get("x-session-id")?.trim() ?? "";
  // Expect a client-generated UUID or high-entropy random ID (>= 16 chars, <= 128 chars)
  if (sessionId.length < 16 || sessionId.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) return null;
  return sessionId;
}

export async function hashSessionId(sessionId: string): Promise<string> {
  const salt = Deno.env.get("SESSION_HASH_SALT") ?? getTokenSecret();
  return sha256Hex(`sess:${salt}:${sessionId}`);
}

export async function hashIpSignal(req: Request): Promise<string> {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const salt = Deno.env.get("IP_HASH_SALT") ?? getTokenSecret();
  return sha256Hex(`ip:${salt}:${ip}`);
}

export async function hashCollegeCode(rawCode: string): Promise<string> {
  const normalized = rawCode.trim().toUpperCase();
  const salt = Deno.env.get("COLLEGE_CODE_SALT") ?? "unsaid_college_code_v1";
  return sha256Hex(`${salt}:${normalized}`);
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: string }> {
  const { data, error } = await supabase.rpc("check_and_increment_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error || !data) {
    throw new Error("Rate limit check failed");
  }

  return {
    allowed: Boolean((data as { allowed: boolean }).allowed),
    remaining: Number((data as { remaining: number }).remaining ?? 0),
    resetAt: String((data as { reset_at: string }).reset_at ?? ""),
  };
}

export async function parseJsonBody<T>(
  req: Request,
  maxBytes = 8192,
): Promise<T | null> {
  const raw = await req.text();
  if (raw.length === 0 || raw.length > maxBytes) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type ModerationResult = {
  decision: "approved" | "pending" | "rejected";
  reason?: string;
};

const HARD_BLOCK_PATTERNS: RegExp[] = [
  /\b(kill yourself|kys|suicide pact|how to die)\b/i,
  /\b(doxx|home address|phone number\s*:\s*\+?\d{7,})\b/i,
  /(https?:\/\/[^\s]+){2,}/i, // excessive links
];

const REVIEW_PATTERNS: RegExp[] = [
  /https?:\/\/[^\s]+/i, // single external link -> hold for admin review
  /\b(fuck|bitch|asshole|slut|whore|mc|bc|chutiya|madarchod|behenchod)\b/i,
  /\b(whatsapp|telegram|insta id|snapchat)\s*[:@]?\s*[a-z0-9._-]{3,}/i,
];

export function moderateText(rawText: string): ModerationResult {
  const text = rawText.trim();

  if (!text) {
    return { decision: "rejected", reason: "Content cannot be empty." };
  }

  // Repeated character flood (e.g., 12+ identical non-space chars)
  if (/(.)\1{11,}/u.test(text)) {
    return { decision: "rejected", reason: "Spammy character repetition detected." };
  }

  for (const pattern of HARD_BLOCK_PATTERNS) {
    if (pattern.test(text)) {
      return {
        decision: "rejected",
        reason: "Submission violates campus safety or anti-spam rules.",
      };
    }
  }

  for (const pattern of REVIEW_PATTERNS) {
    if (pattern.test(text)) {
      return {
        decision: "pending",
        reason: "Held for quick moderator review before appearing publicly.",
      };
    }
  }

  return { decision: "approved" };
}

export function inferVibe(
  text: string,
  requestedVibe?: string,
): "happy" | "stressed" | "excited" | "other" {
  if (
    requestedVibe === "happy" ||
    requestedVibe === "stressed" ||
    requestedVibe === "excited" ||
    requestedVibe === "other"
  ) {
    return requestedVibe;
  }
  const lower = text.toLowerCase();
  if (/\b(stress|exam|assignment|tired|cry|scared|fail|attendance|depressed|lonely)\b/.test(lower)) {
    return "stressed";
  }
  if (/\b(crush|excited|omg|fest|party|can't wait|yay|thrilled)\b/.test(lower)) {
    return "excited";
  }
  if (/\b(happy|love|best friend|grateful|cute|smile|underrated|good friends)\b/.test(lower)) {
    return "happy";
  }
  return "other";
}
