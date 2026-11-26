function normalizeForModeration(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
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

const PROHIBITED_PATTERNS: RegExp[] = [
  /\b(sex|sexy|sexx+|sexual|sexting|porn|porno|pornography|xxx|nude|nudes|naked|horny|boobs|tits|nipple|vagina|penis|dick|cock|pussy|blowjob|handjob|masturbate|masturbation|cum|cumshot|orgasm|erotic|escort|onlyfans|rape|rapist|molest|incest|milf|hentai|nsfw)\b/i,
  /\b(fuck|fucker|fucking|fucked|fck|fuk|fk|motherfucker|mf|shit|bullshit|bitch|bitches|ass|asses|asshole|assholes|bastard|slut|whore|cunt|prick|twat|wanker|stfu|suck my|suck my dick|dickhead|dumbass|jackass|nigga|nigger)\b/i,
  /\b(mc|bc|bkl|bsdk|bsdkw|bsdwk|bhosdk|mkc|bkc|bkp|lkb|tmkc|pkmb|nkc|madarchod|maderchod|madharchod|maadarchod|mdarchod|madarchoda|behenchod|bhenchod|behanchod|behnchod|bhnchod|bnchod|bakchod|bakchodi|bkchod|bhosdi|bhosdike|bhosdika|bhosdiwale|bhosdiwala|bhosadi|bhosadike|bhosda|bhosada|bhosad|bhosadpappu|bhadwa|bhadwe|bhadwaa|bhadwi|bhadva|chutiya|chutiye|chutiyapa|chutiyapanti|chutiyagiri|chutya|chootiya|chutia|chut|choot|chooot|chutmarike|chutmari|chutad|chodu|chod|choda|chodna|chode|chodne|chodra|lund|lnd|lauda|laude|laudu|lavda|lavde|lawda|lawde|loda|lode|louda|loude|lodu|gaand|gand|gandu|gaandu|gandwa|gandmara|gandmasti|gandfat|gandphat|gandya|randi|randwa|randikhana|randibazi|raand|harami|haramkhor|haramzada|haramzadi|haraam|kamina|kamine|kaminey|kamini|kutta|kutte|kuttey|kuta|kutti|kutiya|saala|saale|suar|suwar|tatti|tati|jhatu|jhaatu|jhaat|jhat|chinal|chinaal|chakka|chhakka|hijda|hijra|muth|mutthal|muthal|muthmare|tharki|hawas|hawasi|tatta|tatte|tattey|chuchi|chuchiyan|bubbe|boobe|mamme|dalal|dalla|bulla|aandu|bklode)\b/i,
  /\b(behen ke lode|bhen ke lode|behen ki chut|bhen ki chut|maa ki chut|maa ki choot|maakichut|maa ke lode|maa chuda|maachuda|teri maa ki|teri behan ki|teri ma ka|bhosdi ke|bhosadi ke)\b/i,
  /\b(aai zavli|aai zhavli|aaizhavadya|zavadya|zhavadya|zhavnya|zavnya|bhikarchot|bhikarchod|yedzavya|yedzhavya|yedzava|lavdya|lawdya|laudya|bocha|bochya|bhosadya|randichya|fodri|phodri)\b/i,
  /(मादरचोद|मदरचोद|बहनचोद|भेनचोद|भोसड़ी|भोसडीके|भोसड़ा|भड़वा|भड़वे|चूतिया|चूत|गांड|गांडू|लंड|लौड़ा|लौड़े|लोड़ा|रंडी|हरामी|हरामजादा|हरामखोर|कमीना|कमीने|कुत्ता|कुत्ते|कुतिया|साला|साले|सुअर|टट्टी|झाटू|झांट|छिनाल|छक्का|हिजड़ा|मुठ|मुठ्ठल|हवस|ठरकी|बकचोद|बकचोदी|चोद|चोदना|चोदू|माँ की चूत|बहन के लौड़े|नंगा|नंगी|सेक्स|पॉर्न|न्यूड|रेप)/u,
  /\b(ch[*@#x_]+t|ch[*@#x_]+tiy[ae]|bh[*@#x_]+sd[iy]|bh[*@#x_]*sd[*@#x_]*k[ae]?|m[*@#x_]*d[*@#x_]*rch[*@#x_]*d|b[*@#x_]*h[*@#x_]*nch[*@#x_]*d|g[*@#x_]+ndu?|l[*@#x_]+nd|l[*@#x_]+d[ae]|r[*@#x_]+nd[iy]|f[*@#x_]+ck|sh[*@#x_]+t|b[*@#x_]+tch|s[*@#x_]+x|p[*@#x_]+rn)\b/i,
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
  const collapsed = collapseRepeatedLetters(normalized);
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(text) || pattern.test(normalized) || pattern.test(collapsed)) {
      return {
        ok: false,
        message: "Abusive, explicit, or prohibited words/links are not allowed.",
      };
    }
  }

  if (/\b([a-z0-9]{2,})\b(?:\s+\1\b){3,}/i.test(normalized)) {
    return {
      ok: false,
      message: "Repeated spam words are not allowed.",
    };
  }

  if (!options.isShortLabel) {
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
