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
  ttlSeconds = 60 * 60 * 12,
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

function normalizeForModeration(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    // Convert ! to i only when sandwiched inside a word so "mc!" doesn't turn into "mci"
    .replace(/([a-z0-9])!([a-z0-9])/g, "$1i$2")
    .replace(/@/g, "a")
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/\$/g, "s")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z\u0900-\u097f\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseRepeatedLetters(normalized: string): string {
  return normalized.replace(/([a-z])\1+/g, "$1");
}

const PROFANITY_AND_SEXUAL_PATTERNS: RegExp[] = [
  // Sexual / explicit English terms
  /\b(sex|sexy|sexx+|sexual|sexting|porn|porno|pornography|xxx|nude|nudes|naked|horny|boobs|tits|nipple|vagina|penis|dick|cock|pussy|blowjob|handjob|masturbate|masturbation|cum|cumshot|orgasm|erotic|escort|onlyfans|rape|rapist|molest|incest|milf|hentai|nsfw)\b/i,
  // English profanity & slurs
  /\b(fuck|fucker|fucking|fucked|fck|fuk|fk|motherfucker|mf|shit|bullshit|bitch|bitches|ass|asses|asshole|assholes|bastard|slut|whore|cunt|prick|twat|wanker|stfu|suck my|suck my dick|dickhead|dumbass|jackass|nigga|nigger)\b/i,
  // Hindi / Hinglish gaaliyan, inflections & variations
  /\b(mc|bc|bkl|bsdk|bsdkw|bsdwk|bhosdk|mkc|bkc|bkp|lkb|tmkc|pkmb|nkc|madarchod|maderchod|madharchod|maadarchod|mdarchod|madarchoda|behenchod|bhenchod|behanchod|behnchod|bhnchod|bnchod|bakchod|bakchodi|bkchod|bhosdi|bhosdike|bhosdika|bhosdiwale|bhosdiwala|bhosadi|bhosadike|bhosda|bhosada|bhosad|bhosadpappu|bhadwa|bhadwe|bhadwaa|bhadwi|bhadva|chutiya|chutiye|chutiyapa|chutiyapanti|chutiyagiri|chutya|chootiya|chutia|chut|choot|chooot|chutmarike|chutmari|chutad|chodu|chod|choda|chodna|chode|chodne|chodra|lund|lnd|lauda|laude|laudu|lavda|lavde|lawda|lawde|loda|lode|louda|loude|lodu|gaand|gand|gandu|gaandu|gandwa|gandmara|gandmasti|gandfat|gandphat|gandya|randi|randwa|randikhana|randibazi|raand|harami|haramkhor|haramzada|haramzadi|haraam|kamina|kamine|kaminey|kamini|kutta|kutte|kuttey|kuta|kutti|kutiya|saala|saale|suar|suwar|tatti|tati|jhatu|jhaatu|jhaat|jhat|chinal|chinaal|chakka|chhakka|hijda|hijra|muth|mutthal|muthal|muthmare|tharki|hawas|hawasi|tatta|tatte|tattey|chuchi|chuchiyan|bubbe|boobe|mamme|dalal|dalla|bulla|aandu|bklode)\b/i,
  // Multi-word Hindi / Hinglish abusive phrases
  /\b(behen ke lode|bhen ke lode|behen ki chut|bhen ki chut|maa ki chut|maa ki choot|maakichut|maa ke lode|maa chuda|maachuda|teri maa ki|teri behan ki|teri ma ka|bhosdi ke|bhosadi ke)\b/i,
  // Marathi / Pune regional slurs
  /\b(aai zavli|aai zhavli|aaizhavadya|zavadya|zhavadya|zhavnya|zavnya|bhikarchot|bhikarchod|yedzavya|yedzhavya|yedzava|lavdya|lawdya|laudya|bocha|bochya|bhosadya|randichya|fodri|phodri)\b/i,
  // Devanagari script Hindi / Marathi gaaliyan & explicit words
  /(मादरचोद|मदरचोद|बहनचोद|भेनचोद|भोसड़ी|भोसडीके|भोसड़ा|भड़वा|भड़वे|चूतिया|चूत|गांड|गांडू|लंड|लौड़ा|लौड़े|लोड़ा|रंडी|हरामी|हरामजादा|हरामखोर|कमीना|कमीने|कुत्ता|कुत्ते|कुतिया|साला|साले|सुअर|टट्टी|झाटू|झांट|छिनाल|छक्का|हिजड़ा|मुठ|मुठ्ठल|हवस|ठरकी|बकचोद|बकचोदी|चोद|चोदना|चोदू|माँ की चूत|बहन के लौड़े|नंगा|नंगी|सेक्स|पॉर्न|न्यूड|रेप)/u,
  // Censored / asterisk / symbol masked evasions (matched on raw text before normalization strips punctuation)
  /\b(ch[*@#x_]+t|ch[*@#x_]+tiy[ae]|bh[*@#x_]+sd[iy]|bh[*@#x_]*sd[*@#x_]*k[ae]?|m[*@#x_]*d[*@#x_]*rch[*@#x_]*d|b[*@#x_]*h[*@#x_]*nch[*@#x_]*d|g[*@#x_]+ndu?|l[*@#x_]+nd|l[*@#x_]+d[ae]|r[*@#x_]+nd[iy]|f[*@#x_]+ck|sh[*@#x_]+t|b[*@#x_]+tch|s[*@#x_]+x|p[*@#x_]+rn)\b/i,
  // Spaced / dotted obfuscations (e.g., "s e x", "m.c", "b c", "b.s.d.k", "c h u t", "g a n d")
  /\bs[\s._*\-]+e[\s._*\-]+x\b/i,
  /\bf[\s._*\-]+u[\s._*\-]+c[\s._*\-]+k\b/i,
  /\bm[\s._*\-]+c\b/i,
  /\bb[\s._*\-]+c\b/i,
  /\bb[\s._*\-]+k[\s._*\-]+l\b/i,
  /\bm[\s._*\-]+k[\s._*\-]+c\b/i,
  /\bb[\s._*\-]+s[\s._*\-]+d[\s._*\-]+k\b/i,
  /\bc[\s._*\-]+h[\s._*\-]+u[\s._*\-]+t\b/i,
  /\bg[\s._*\-]+a[\s._*\-]+n[\s._*\-]+d\b/i,
  /\bl[\s._*\-]+u[\s._*\-]+n[\s._*\-]+d\b/i,
  /\br[\s._*\-]+a[\s._*\-]+n[\s._*\-]+d[\s._*\-]+i\b/i,
  // Self-harm / severe safety / doxxing / spam links
  /\b(kill yourself|kys|suicide pact|how to die|commit suicide)\b/i,
  /\b(doxx|home address|phone number\s*:\s*\+?\d{7,})\b/i,
  /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+\.(com|in|org|net|xyz|ly)\/[^\s]*)/i,
  /\b(whatsapp|telegram|insta|instagram|snapchat)\s*[:@]?\s*[a-z0-9._+-]{3,}/i,
];

const KEYBOARD_SMASH_RE = /(asdfg|sdfgh|dfghj|fghjk|ghjkl|qwert|werty|ertyu|rtyui|tyuio|yuiop|zxcvb|xcvbn|cvbnm)/i;

export function moderateText(
  rawText: string,
  options: { isShortLabel?: boolean } = {},
): ModerationResult {
  const text = rawText.trim();

  if (!text) {
    return { decision: "rejected", reason: "Content cannot be empty." };
  }

  // Repeated character flood (e.g., 6+ identical chars like "aaaaaa" or "!!!!!!")
  if (/(.)\1{5,}/u.test(text)) {
    return {
      decision: "rejected",
      reason: "Please avoid spammy repeated characters.",
    };
  }

  // Check raw + normalized + repeat-collapsed text for Hindi/English/Devanagari abuse
  const normalized = normalizeForModeration(text);
  const collapsed = collapseRepeatedLetters(normalized);
  for (const pattern of PROFANITY_AND_SEXUAL_PATTERNS) {
    if (pattern.test(text) || pattern.test(normalized) || pattern.test(collapsed)) {
      return {
        decision: "rejected",
        reason: "Abusive, explicit, or prohibited words/links are not allowed.",
      };
    }
  }

  // Repeated same word spam applies to BOTH confessions and comments
  if (/\b([a-z0-9]{2,})\b(?:\s+\1\b){3,}/i.test(normalized)) {
    return {
      decision: "rejected",
      reason: "Repeated spam words are not allowed.",
    };
  }

  if (!options.isShortLabel) {
    // Require meaningful alphabetic letters (avoid pure symbols/numbers/gibberish)
    const letterCount = (text.match(/[a-zA-Z\u0900-\u097F]/g) ?? []).length;
    if (letterCount < 4) {
      return {
        decision: "rejected",
        reason: "Please write a meaningful message with real words.",
      };
    }

    // Keyboard smash or vowelless gibberish token check
    if (KEYBOARD_SMASH_RE.test(normalized)) {
      return {
        decision: "rejected",
        reason: "Random keyboard spam is not allowed.",
      };
    }

    const tokens = normalized.split(" ").filter(Boolean);
    for (const tok of tokens) {
      if (tok.length >= 14 && !/[aeiouy\u0900-\u097f]/.test(tok)) {
        return {
          decision: "rejected",
          reason: "Random gibberish text is not allowed.",
        };
      }
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
