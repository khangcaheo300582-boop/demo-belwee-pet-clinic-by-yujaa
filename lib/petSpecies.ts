// lib/petSpecies.ts
// Pet-species validation for the "Khác" free-text field on the profile and
// booking forms.
//
// THE PROBLEM
//   When a customer picks "Khác", the field accepts anything, and people type
//   their own name ("An", "Minh"), a phone number, or a whole sentence. The
//   result is a clinic record whose species is "Nguyễn Văn A" — which then shows
//   up on the staff queue as a nonsensical row.
//
// HOW IT IS JUDGED — and why not with a dictionary alone
//   A pure allow-list is the obvious approach and it is wrong on its own: it
//   rejects every animal the clinic has never heard of, and Belwee explicitly
//   treats unusual animals as its differentiator (hamster, alpaca, tortoise,
//   hedgehog). So the check is a REJECTION test rather than an acceptance test:
//
//     1. A Vietnamese/English animal dictionary earns a pass. This list is
//        generous on purpose — it includes the exotic species the clinic
//        advertises plus common zoo/farm animals, precisely so "alpaca" and
//        "nhím" are never blocked.
//     2. A Vietnamese personal name, or a phrase that reads as one, is rejected.
//        This is the list that must NOT be generous: adding a surname here
//        rejects a legitimate species nobody thought of, which is the more
//        harmful direction.
//     3. Anything left over is ACCEPTED with a note. Guessing wrong in the
//        reject direction blocks real customers; guessing wrong in the accept
//        direction merely lets an unusual species through, which a vet corrects
//        in one click at the desk.
//
// STEP 3 IS THE HONEST DEFAULT. A validator that guesses must pick a failure
// mode, and this one picks the reversible one.

/** Common + exotic animals a Vietnamese clinic actually sees. */
const ANIMALS_VI = [
  // Domestic
  'chó', 'cún', 'cau', 'chó con', 'cho', 'chuc', 'cỏ', 'núi',
  'mèo', 'mèo con', 'meo', 'mèo mướp', 'mèo tam thể', 'mèo rừng',
  'thỏ', 'tho', 'thỏ trắng',
  // Small pets
  'chuột', 'chuột hamster', 'hamster', 'chuột lang', 'chinchilla',
  'sóc', 'soc', 'sóc bay', 'lợn đất', 'nhím', 'chim', 'chim bồ câu', 'vẹt', 've',
  'cá', 'cá vàng', 'cá kiếm', 'rùa', 'cua rùa', 'Ếch', 'ếch', 'côn trùng', 'bọ rùa',
  'chồn sương', 'hảo cẩu', 'hảo', 'cáo', 'gấu', 'hổ', 'sư tử',
  // Farm / large animals the clinic mentions
  'alpaca', 'lạc đà', 'lama', 'ngựa', 'ngựa vằn', 'bò', 'dê', 'cừu', 'heo',
  'voi', 'khỉ', 'gấu',
  // Birds
  'vẹt mào', 'yến phụng', 'chim sẻ', 'chim én', 'bồ câu', 'gà', 'vịt',
  // Water
  'cá koi', 'rùa biển', 'sứa', 'cá ngựa', 'tôm', 'cua',
];

const ANIMALS_EN = [
  'dog', 'dogs', 'puppy', 'puppies', 'cat', 'cats', 'kitten', 'kittens',
  'rabbit', 'bunny', 'hamster', 'guinea pig', 'chinchilla', 'hedgehog',
  'squirrel', 'ferret', 'parrot', 'budgie', 'bird', 'pigeon', 'chicken', 'duck',
  'turtle', 'tortoise', 'frog', 'snake', 'lizard', 'gecko', 'fish', 'goldfish',
  'koi', 'alpaca', 'llama', 'horse', 'pony', 'cow', 'cattle', 'goat', 'sheep',
  'pig', 'camel', 'elephant', 'monkey', 'bear', 'fox', 'raccoon', 'koala',
];

/**
 * Vietnamese family, middle and given names.
 *
 * Broad on purpose (see the file header): a missing surname here means a real
 * customer's own name reaches the clinic as a species. Family names, middle
 * names ("Thị", "Văn", "Hữu") and single given names are all included,
 * because people type their full name into this field.
 */
const NAMES_VI = [
  // Family names
  'nguyễn', 'trần', 'lê', 'phạm', 'hoàng', 'huỳnh', 'phan', 'vũ', 'võ', 'đặng',
  'bùi', 'đỗ', 'hồ', 'ngô', 'dương', 'lý', 'đinh', 'tạ', 'trương', 'cao',
  'tô', 'đoàn', 'lâm', 'hà', 'vương', 'lưu', 'tạo', 'quách', 'mai',
  // Middle names
  'văn', 'thị', 'thị', 'hữu', 'mạnh', 'ngọc', 'đức', 'thanh', 'quang',
  'xuân', 'kim', 'hoa', 'bá', 'anh', 'thu', 'hải', 'đình', 'công', 'tín',
  'vĩ', 'hồng', 'như', 'thúy', 'thuỷ', 'mai', 'lan', 'thảo',
  // Given names — including single-token ones, since "Minh" alone must be caught
  'nguyên', 'an', 'bao', 'bảo', 'bình', 'cẩm', 'chi', 'cường', 'dũng',
  'đạt', 'đức', 'giang', 'hải', 'hạnh', 'hân', 'hiếu', 'hoài', 'hùng',
  'hưng', 'huy', 'khánh', 'khoa', 'kiên', 'kim', 'lan', 'lập', 'liên',
  'linh', 'loan', 'long', 'lộc', 'mai', 'mạnh', 'minh', 'mỹ', 'nam',
  'ngan', 'ngọc', 'nhi', 'nhật', 'nhân', 'phúc', 'phương', 'quân', 'quang',
  'quốc', 'quỳnh', 'sơn', 'tâm', 'tấn', 'thắng', 'thảo', 'thanh', 'thiện',
  'châu', 'cảnh', 'cẩn', 'dũng', 'hồng', 'hào', 'hậu', 'huệ', 'khang',
  'thu', 'tiến', 'toàn', 'trang', 'trí', 'trung', 'tuấn', 'tùng', 'tứ',
  'tuệ', 'uyên', 'vân', 'văn', 'việt', 'vinh', 'vy', 'xuân', 'yến', 'an',
  'hương', 'phượng', 'thanh', 'quân', 'khang', 'nghiệp', 'tường', 'oanh',
  'linh', 'khánh', 'hải', 'dương', 'nhật', 'phúc', 'quý', 'tài', 'hậu',
  'thanh', 'kim', 'oanh', 'diệp', 'phượng', 'miên', 'đào', 'mai', 'nhi',
  'ninh', 'hảo', 'tường', 'khánh', 'hoài', 'thuận', 'hiền', 'lộc', 'an',
];

/** Titles / honorifics — "Anh Nguyễn", "Chị Lan" are people, not species. */
const PERSON_TOKENS = [
  'anh', 'chị', 'em', 'bác', 'cô', 'chú', 'mợ', 'bạn', 'tôi', 'tui', 'tao',
  'mr', 'mrs', 'ms', 'miss', 'dr', 'bs', 'ts', 'ths',
];

/**
 * Words that only appear in a phrase, never in a species name.
 *
 * Note "con" is absent: it is the ordinary Vietnamese classifier ("con mèo" =
 * "the cat") and appears in perfectly good answers, so treating it as a
 * sentence marker would reject real input.
 */
const SENTENCE_TOKENS = [
  'cua', 'toi', 'nha', 'o', 'dang', 'rat', 'be', 'bi', 'benh',
  'tu', 'hoi', 'thang', 'nam', 'nay', 'truoc', 'sau', 'khi',
  'cho', 'voi', 'va', 'nhung', 'de', 've', 'tai', 'noi',
  'thuoc', 'gia', 'tiem', 'kham', 'chua', 'roi',
];

/** Strip diacritics so "Chó" and "cho" collapse to one token. */
export function deaccent(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** Lowercase, accent-free, punctuation-free. */
function normalize(value: string): string {
  return deaccent(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dictionaries are keyed on the NORMALIZED form (accent-free, lowercased) because
// that is what the input is compared against.
const ANIMALS = new Set([...ANIMALS_VI, ...ANIMALS_EN].map(normalize));
const NAMES = new Set(NAMES_VI.map(normalize));
const PERSON_TOKENS_SET = new Set(PERSON_TOKENS.map(normalize));
const SENTENCE_TOKENS_SET = new Set(SENTENCE_TOKENS.map(deaccent));

/**
 * Does this phrase contain a known animal?
 *
 * Substring, not exact-match, because users write "chó husky", "mèo ragdoll",
 * "chuột hamster". Exact matching would reject every breed-qualified answer.
 */
function containsAnimal(normalized: string): boolean {
  if (ANIMALS.has(normalized)) return true;
  const tokens = normalized.split(' ');
  for (const animal of ANIMALS) {
    // Only multi-word animals need a phrase check; single words appear as a token.
    if (!animal.includes(' ')) continue;
    if (normalized.includes(animal)) return true;
  }
  return tokens.some((token) => ANIMALS.has(token));
}

/**
 * Does this phrase read as a Vietnamese personal name?
 *
 * Every token must be a known name — an all-or-nothing rule. A looser "some
 * tokens are names" test was the original bug: "Phan Thị Tứ" contains the given
 * name "Tứ" but its first token "phan" was missing from the dictionary, so the
 * partial match missed it. Requiring EVERY token to be a name is both simpler
 * and strictly stronger for the case that matters (someone typed their name),
 * and it cannot misfire on a species because pass 1 already returned for any
 * input containing an animal.
 */
function containsPersonName(normalized: string): boolean {
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return false;

  // A bare honorific ("anh", "chị") is a person reference, never a species.
  if (tokens.every((token) => PERSON_TOKENS_SET.has(token))) return true;

  // Every token is a name, or an honorific alongside one.
  const allNames = tokens.every((token) => NAMES.has(token) || PERSON_TOKENS_SET.has(token));
  if (allNames) return true;

  // Vietnamese names routinely end in a single-letter initial — "Nguyễn Văn A",
  // "Lê Minh Châu" written as "Lê Minh C". Those initials are not in the
  // dictionary, so all-names-true fails and the name slips through. Allow a
  // one-character token ONLY when every other token is a real name; a lone
  // initial on its own ("A") cannot reach here because of the length guard.
  if (tokens.length >= 2) {
    const withoutInitials = tokens.filter((token) => token.length > 1);
    const hasInitials = withoutInitials.length < tokens.length;
    if (
      hasInitials &&
      withoutInitials.length > 0 &&
      withoutInitials.every((token) => NAMES.has(token) || PERSON_TOKENS_SET.has(token))
    ) {
      return true;
    }
  }

  // A single bare name — "Nguyễn", "Minh", "Hương". A lone animal token was
  // already handled by pass 1, so reaching here with one token means the caller
  // typed a person's name rather than a species.
  return tokens.length === 1 && NAMES.has(tokens[0]);
}

/** A run of digits is a phone number, a date, an ID — never a species. */
function looksLikeNumber(normalized: string): boolean {
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 4;
}

export type SpeciesVerdict =
  | { ok: true; note?: string }
  | { ok: false; reason: 'empty' | 'tooShort' | 'tooLong' | 'personName' | 'sentence' };

/**
 * Judge a free-text pet species.
 *
 * Returns `ok: true` for anything it cannot confidently reject. See the file
 * header for why guessing always resolves toward accepting.
 */
export function validatePetSpecies(raw: string): SpeciesVerdict {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.length < 2) return { ok: false, reason: 'tooShort' };
  // 60 chars is already past "chuột hamster nuôi trong lồng"; beyond that it is
  // a sentence, not a species.
  if (trimmed.length > 60) return { ok: false, reason: 'tooLong' };

  const normalized = normalize(trimmed);
  if (!normalized) return { ok: false, reason: 'empty' };

  // Pass 1 — digits. A phone number, a date or a customer id is never a
  // species, and none of those contain an animal either, so this can only
  // prevent a false ACCEPT at the end.
  if (looksLikeNumber(normalized)) return { ok: false, reason: 'sentence' };

  // Pass 2 — a sentence. Checked BEFORE the animal test on purpose: "tôi nuôi
  // con mèo bị bệnh" contains "meo", and a plain animal-first ordering would
  // happily accept a whole sentence as a species.
  const tokens = normalized.split(' ').filter(Boolean);
  const sentenceTokens = tokens.filter((token) => SENTENCE_TOKENS_SET.has(token)).length;
  if (tokens.length > 4 || (sentenceTokens >= 2 && tokens.length > 2)) {
    return { ok: false, reason: 'sentence' };
  }

  // Pass 3 — a known animal always wins. Reached only after the sentence and
  // number tests, so "chó của tôi" is rejected and "chó husky" is not.
  if (containsAnimal(normalized)) return { ok: true };

  // Pass 4 — reject obvious people.
  if (containsPersonName(normalized)) {
    return {
      ok: false,
      reason: 'personName',
    };
  }

  // Pass 5 — accept the unfamiliar. A real exotic species the clinic has not
  // heard of should reach the vet, not be blocked by a dictionary.
  return { ok: true, note: 'unknown' };
}

/** Vietnamese error copy, ready for the UI. */
export const SPECIES_ERROR_MESSAGES: Record<Exclude<SpeciesVerdict['ok'] extends true ? never : 'empty' | 'tooShort' | 'tooLong' | 'personName' | 'sentence', never>, string> = {
  empty: 'Vui lòng nhập tên loài thú cưng.',
  tooShort: 'Tên loài quá ngắn.',
  tooLong: 'Vui lòng nhập tên loài, không phải câu văn dài.',
  personName:
    'Vui lòng nhập tên LOÀI vật (chó, mèo, hamster, alpaca…), không phải tên người.',
  sentence:
    'Vui lòng chỉ nhập tên loài vật, không phải mô tả dài. Ví dụ: chó, mèo, hamster.',
};

/** Suggestions offered when validation fails — helps the user recover. */
export const SPECIES_SUGGESTIONS = [
  'Chó',
  'Mèo',
  'Hamster',
  'Thỏ',
  'Chuột lang',
  'Sóc',
  'Nhím',
  'Alpaca',
  'Rùa',
  'Chồn sương',
  'Vẹt',
  'Chim',
  'Cá',
  'Lợn đất',
] as const;