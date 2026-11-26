function normalizeForModeration(input: string): string {
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/@/g, "a")
    .replace(/4/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/!/g, "i")
    .replace(/0/g, "o")
    .replace(/\$/g, "s")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z\u0900-\u097f\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROHIBITED_PATTERNS: RegExp[] = [
  /\b(sex|sexy|sexx+|sexual|sexting|porn|porno|pornography|xxx|nude|nudes|naked|horny|boobs|tits|nipple|vagina|penis|dick|cock|pussy|blowjob|handjob|masturbate|masturbation|cum|cumshot|orgasm|erotic|escort|onlyfans|rape|rapist|molest|incest)\b/i,
  /\b(fuck|fucker|fucking|fucked|fck|fuk|motherfucker|mf|shit|bullshit|bitch|bitches|ass|asses|asshole|assholes|bastard|slut|whore|cunt|prick|twat|wanker|stfu|suck my)\b/i,
  /\b(mc|bc|bkl|bsdk|mkc|bkc|bhosdike|bhosdi|bhosda|madarchod|maderchod|madharchod|behenchod|bhenchod|behen ke lode|chutiya|chutiye|chutiyapa|chut|chooot|lund|lauda|lavda|loda|lawda|gaand|gand|gandu|randi|randwa|harami|haramzada|kamina|kamine|kutte|kutta|kutti|saala|saale|suar|tatti|jhatu|jhaat|chinaal|chinal|pataka|maal)\b/i,
  /\bs[\s._*-]+e[\s._*-]+x\b/i,
  /\bf[\s._*-]+u[\s._*-]+c[\s._*-]+k\b/i,
  /\bm[\s._*-]+c\b/i,
  /\bb[\s._*-]+c\b/i,
  /\bb[\s._*-]+s[\s._*-]+d[\s._*-]+k\b/i,
  /\b(kill yourself|kys|suicide pact|how to die|commit suicide)\b/i,
  /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+\.(com|in|org|net|xyz|ly)\/[^\s]*)/i,
  /\b(whatsapp|telegram|insta|instagram|snapchat)\s*[:@]?\s*[a-z0-9._+-]{3,}/i,
];

const KEYBOARD_SMASH_RE =
  /(asdfg|sdfgh|dfghj|fghjk|ghjkl|qwert|werty|ertyu|rtyui|tyuio|yuiop|zxcvb|xcvbn|cvbnm)/i;

export function checkContentAllowed(
  rawText: string,
  options: { isShortLabel?: boolean } = {},
): { ok: true } | { ok: false; message: string } {
  const text = rawText.trim();
  if (!text) {
    return { ok: false, message: "Content cannot be empty." };
  }

  if (/(.)\1{5,}/u.test(text)) {
    return {
      ok: false,
      message: "Please avoid spammy repeated characters.",
    };
  }

  const normalized = normalizeForModeration(text);
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(text) || pattern.test(normalized)) {
      return {
        ok: false,
        message: "Abusive, explicit, or prohibited words/links are not allowed.",
      };
    }
  }

  if (!options.isShortLabel) {
    if (/\b([a-z0-9]{2,})\b(?:\s+\1\b){3,}/i.test(normalized)) {
      return {
        ok: false,
        message: "Repeated spam words are not allowed.",
      };
    }

    const letterCount = (text.match(/[a-zA-Z\u0900-\u097F]/g) ?? []).length;
    if (letterCount < 4) {
      return {
        ok: false,
        message: "Please write a meaningful message with real words.",
      };
    }

    if (KEYBOARD_SMASH_RE.test(normalized)) {
      return {
        ok: false,
        message: "Random keyboard spam is not allowed.",
      };
    }

    const tokens = normalized.split(" ").filter(Boolean);
    for (const tok of tokens) {
      if (tok.length >= 14 && !/[aeiouy\u0900-\u097f]/.test(tok)) {
        return {
          ok: false,
          message: "Random gibberish text is not allowed.",
        };
      }
    }
  }

  return { ok: true };
}
