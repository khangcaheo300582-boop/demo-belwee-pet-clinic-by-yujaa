/**
 * lib/petCareTools.ts
 * Toán học cho các công cụ tiện ích của khách (I2).
 *
 * ⚠️ ĐÂY KHÔNG PHẢI TƯ VẤN Y KHOA
 *   Cả ba hàm đều là phép tính xấp xỉ dựa trên khung chăm sóc dùng trong dịch
 *   vụ thú y, chỉ để khách tự ước lượng trước khi gọi. Ngưỡng cảnh báo cố ý
 *   hạ thấp hơn ngưỡng cấp cứu thật — mục tiêu là "đi khám sớm", không phải
 *   "chẩn đoán". Mọi kết quả đều kèm lời nhắc đưa thú cưng đến bác sĩ.
 *
 * NGUỒN CON SỐ
 *   Thang quy đổi tuổi hai giai đoạn: hai năm đầu lên nhanh (chó ~12 năm-người
 *   mỗi năm, mèo ~11), sau đó mỗi năm thú ≈ 5 năm-người (chó) hoặc 4 (mèo).
 *   Cách này cho chó 10 tuổi ≈ 64 năm người — khớp với nghiên cứu tuổi thọ
 *   tương đương (giống lớn ~66, giống nhỏ ~72). Khẩu phần 1,1–3,0× trọng
 *   lượng/ngày tuỳ độ tuổi. KHÔNG phải chẩn đoán.
 *
 *   File này không chứa chuỗi hiển thị: nhãn triệu chứng là MÃ (`breathing1`),
 *   khuyến nghị là khoá i18n (`tools.checklistUrgent`). UI mới dịch.
 */

import { translations, type MessageKey } from "./i18n";

export type PetKind = "dog" | "cat";

/**
 * Mã triệu chứng được SINH RA từ khoá i18n, không khai tay.
 *
 * Vì sao: nếu khai union thủ công rồi thêm mã mới mà quên thêm
 * `tools.symptoms.<mã>` vào lib/i18n.ts, trang vẫn lên được nhưng ô nhãn hiện
 * rỗng — lỗi im lặng, chỉ lộ ra khi khách thấy. Ở đây thiếu khoá i18n là không
 * typecheck được ngay.
 */
export type SymptomId = keyof (typeof translations)["en"]["tools"]["symptoms"];

/**
 * Kiểm tra lúc biên dịch: nhánh `vi` phải có đủ bộ khoá như `en`.
 *
 * Gán giá trị `true` vào kiểu điều kiện — nếu `vi` thiếu khoá, kiểu rút ra là
 * `never` và việc gán này thành lỗi biên dịch. Export ra để ESLint không báo
 * khai báo thừa.
 */
export type ViSymptomsMatchEn =
  SymptomId extends keyof (typeof translations)["vi"]["tools"]["symptoms"]
    ? true
    : never;

export const VI_SYMPTOMS_MATCH_EN: ViSymptomsMatchEn = true;

/* ────────────────────────────────────────────────────────────────────────────
   1. Quy đổi tuổi
   ──────────────────────────────────────────────────────────────────────────── */

/** Hệ số giai đoạn trẻ — năm thứ nhất/thứ hai quy ra bao nhiêu năm người. */
const EARLY_HUMAN_PER_YEAR = { dog: 12, cat: 11 } as const;
/** Hệ số giai đoạn trưởng thành — từ năm thứ ba trở đi. */
const LATE_HUMAN_PER_YEAR = { dog: 5, cat: 4 } as const;
/** Số năm thú dùng cho giai đoạn lớn tốc độ. */
const EARLY_YEARS = 2;

/**
 * Trần hiển thị. 99 năm là con số "không đời người nào sống tới", nên nó
 * truyền tải đúng ý "thang này đã hết ý nghĩa ở tuổi thú này" mà vẫn không
 * trông như một kết quả thật.
 *
 * VÌ SAO PHẢI DÙNG `Math.min` CHỨ KHÔNG `return` SỚM
 *   Bản đầu viết `if (tuổi_thú >= MAX) return MAX`. Chó 29,75 tuổi ra
 *   162,75 rồi nhảy về 30 ở 30 tuổi — hàm GIẢM giá trị, và trên giao diện
 *   mọi con chó trên 3,2 tuổi đều hiện "30". Người dùng kéo slider thấy con
 *   số đứng yên từ năm thứ tư. `Math.min` giữ đường cong đơn điệu không giảm:
 *   nó bão hoà ở 99 thay vì quay ngược.
 *
 *   Điểm bão hoà: chó ~17 tuổi, mèo ~21 tuổi — đều trên thọ xuất thực của
 *   loài, nên thang tuyến tính chỉ còn ý nghĩa trong đúng khoảng khách quan
 *   tâm.
 */
const MAX_HUMAN_YEARS = 99;

/**
 * Tuổi tương đương của người.
 *
 * VÌ SAO KHÔNG DÙNG CÔNG THỨC NHÂN ĐƠN GIẢN "×7 RỒI CỘNG 3"
 *   Công thức nhân 7 cho kết quả quá lớn ở tuổi thành thục: chó 10 tuổi ra ~73
 *   "tuổi người" trong khi nghiên cứu về tuổi thọ tương đương của giống lớn cho
 *   ~66 và của giống nhỏ ~72. Ngược lại, một hằng số tuyến tính cho ra chó 2
 *   tuổi = 30 năm người, cũng quá. Tuổi hoá KHÔNG đều: hai năm đầu lên rất
 *   nhanh, rồi chậm lại — đó chính là lý do cần hai đoạn tuyến tính chứ một
 *   hằng số không đủ.
 *
 *   Mèo "trẻ hơn" chó ở giai đoạn trưởng thành: chó cần ~8 năm mới thành
 *   trưởng thành, mèo ~5, nhưng mèo già đi chậm hơn nên đường quy đổi của mèo
 *   không bao giờ vượt đường của chó cùng tuổi thú.
 */
export function humanAgeYears(kind: PetKind, petYears: number): number {
  const years = Math.max(0, petYears);

  const raw =
    years <= EARLY_YEARS
      ? years * EARLY_HUMAN_PER_YEAR[kind]
      : EARLY_YEARS * EARLY_HUMAN_PER_YEAR[kind] +
        (years - EARLY_YEARS) * LATE_HUMAN_PER_YEAR[kind];

  // `Math.min` chứ không phải `if (tuổi >= MAX) return MAX` — xem giải thích
  // ngay cạnh hằng MAX_HUMAN_YEARS. Dạng `return` sớm làm hàm giảm giá trị
  // ở biên, khiến đường cong không đơn điệu.
  return Math.min(raw, MAX_HUMAN_YEARS);
}

/**
 * Tách kết quả thành `{ năm, tháng }` để UI ghép theo i18n.
 *
 * VÌ SAO CÓ HÀM NÀY
 *   Trả về số thập phân (một chó 8 tuổi = 54 "năm người") thì không có nghĩa
 *   gì với người đọc. Quy ra tuổi NGƯỜI thành năm/tháng cho dễ hình dung.
 *
 *   LUÔN trả về cặp số, không bao giờ `null` — tháng luôn nằm trong 0..9, nên
 *   UI chỉ cần ẩn đi phần tháng khi nó bằng 0. Trước đây hàm trả `null` ở tuổi
 *   trên 2 năm, kéo theo nhánh fallback trong component chỉ để gọi lại chính
 *   `humanAgeYears` rồi làm tròn: một nhánh chết kéo theo hai đường tính cho
 *   cùng một con số.
 */
export function humanAgeParts(
  kind: PetKind,
  petYears: number
): { years: number; months: number } {
  const human = humanAgeYears(kind, petYears);
  if (human < 1) return { years: 0, months: 0 };

  const wholeYears = Math.floor(human);
  // ×10 thay vì ×12: phần thập phân của năm người không phải năm người, mà là
  // "xem 0,7 năm người". Chia 10 cho số tròn 0..9, rồi tròn.
  let months = Math.round((human - wholeYears) * 10);
  let yearsOut = wholeYears;
  if (months === 10) {
    months = 0;
    yearsOut += 1;
  }
  return { years: yearsOut, months };
}

/* ────────────────────────────────────────────────────────────────────────────
   2. Khẩu phần
   ──────────────────────────────────────────────────────────────────────────── */

export interface PortionResult {
  /** grams mỗi ngày */
  gramsPerDay: number;
  /** grams mỗi bữa (chia đều `meals`) */
  gramsPerMeal: number;
  meals: number;
}

/**
 * Lượng thức ăn gợi ý theo cân nặng.
 *
 * Chia nhỏ tỉ lệ theo độ tuổi và trạng thái để con số gần thực tế hơn một
 * hằng số:
 *   • chó con < 4 tháng → 3,0× (đang lớn rất nhanh)
 *   • chó con 4–12 tháng → 2,5×
 *   • mèo con < 4 tháng → 2,5×
 *   • mèo con 4–12 tháng → 2,0×
 *   • trưởng thành → 2,0× (chó), 1,1× (mèo)
 *   • béo phì (giả định 20% vượt chuẩn) → nhân 0,8
 *
 * Sàn 0,5kg: slider kéo về 0 sẽ ra `gramsPerDay = 0` và phần "mỗi bữa" chia 0.
 */
export function dailyPortion(
  kind: PetKind,
  weightKg: number,
  ageMonths: number,
  overweight = false
): PortionResult {
  const kg = Math.max(0.5, weightKg);

  let perKg: number;
  if (ageMonths < 4) perKg = kind === "dog" ? 3.0 : 2.5;
  else if (ageMonths < 12) perKg = kind === "dog" ? 2.5 : 2.0;
  else perKg = kind === "dog" ? 2.0 : 1.1;

  if (overweight) perKg *= 0.8;

  const gramsPerDay = Math.round(kg * perKg * 1000);
  // Chó ăn ít bữa hơn mèo; trên 6 tháng mới chia 2 bữa thay vì 3.
  const meals = kind === "dog" ? (ageMonths < 6 ? 3 : 2) : 3;

  return {
    gramsPerDay,
    gramsPerMeal: Math.round(gramsPerDay / meals),
    meals,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   3. Kiểm tra triệu chứng sơ bộ
   ──────────────────────────────────────────────────────────────────────────── */

/** Mức độ nghiêm trọng từ kết quả. Không phải chẩn đoán. */
export type Severity = "watch" | "soon" | "urgent";

export interface SymptomCheck {
  /** Điểm rủi ro tổng — xem `triageScore`. */
  score: number;
  severity: Severity;
  /** Nhóm triệu chứng nguy hiểm đã bật. */
  critical: string[];
  /** Khoá khuyến nghị cho UI tra qua i18n. */
  adviceKey: SymptomAdviceKey;
}

/**
 * Khoá khuyến nghị. Khai đúng tên khoá i18n nên `t(check.adviceKey)` không
 * cần ép kiểu — thêm khoá sai ở đây sẽ không typecheck.
 */
export type SymptomAdviceKey = Extract<
  MessageKey,
  | "tools.checklistNone"
  | "tools.checklistWatch"
  | "tools.checklistSoon"
  | "tools.checklistUrgent"
>;

export interface SymptomGroup {
  id: string;
  /**
   * `true` = một mã bật là ra `urgent`. `false` = nhóm dấu hiệu nhẹ, chỉ góp
   * vào tổng điểm.
   *
   * VÌ SAO PHẢI CÓ NHÓM `critical = false`
   *   Ban đầu mọi mã đều nằm trong nhóm nguy hiểm, nghĩa là chỉ cần tick một ô
   *   là ra "cấp cứu" — công cụ hoá ra thành một cái chuông báo động không
   *   bao giờ yên tĩnh. Người dùng dễ lần đầu thấy "Đến ngay" thì hoảng, lần
   *   sau không tick gì cả. Nhóm nhẹ làm cho ba mức cảnh báo thực sự phân biệt
   *   được nhau.
   */
  critical: boolean;
  symptoms: readonly SymptomId[];
}

export const SYMPTOM_GROUPS: readonly SymptomGroup[] = [
  { id: "breathing", critical: true, symptoms: ["breathing1", "breathing2"] },
  {
    id: "gastroEmergency",
    critical: true,
    symptoms: ["gastro1", "gastro2", "gastro3"],
  },
  { id: "neuro", critical: true, symptoms: ["neuro1", "neuro2", "neuro3"] },
  { id: "trauma", critical: true, symptoms: ["trauma1", "trauma2", "trauma3"] },
  { id: "toxic", critical: true, symptoms: ["toxic1", "toxic2", "toxic3"] },
  { id: "paralysis", critical: true, symptoms: ["paralysis1", "paralysis2"] },
  { id: "urinal", critical: true, symptoms: ["urinal1", "urinal2"] },
  {
    id: "mild",
    critical: false,
    symptoms: [
      "mild1",
      "mild2",
      "mild3",
      "mild4",
      "mild5",
      "mild6",
      "mild7",
      "mild8",
    ],
  },
];

/** Các nhóm mà một mã là đã ra mức cấp cứu. */
const CRITICAL_GROUPS: readonly SymptomGroup[] = SYMPTOM_GROUPS.filter(
  (group) => group.critical
);

/** Toàn bộ mã triệu chứng, làm phẳng từ các nhóm — dùng để render checkbox. */
export const ALL_SYMPTOM_IDS: readonly SymptomId[] = SYMPTOM_GROUPS.flatMap(
  (group) => group.symptoms
);

/** Tra cứu nhanh: mã này có thuộc nhóm nguy hiểm không. */
const CRITICAL_IDS: ReadonlySet<string> = new Set(
  CRITICAL_GROUPS.flatMap((group) => group.symptoms)
);

/** Toàn bộ mã hợp lệ — dùng để bỏ mã lạ trước khi chấm điểm. */
const KNOWN_IDS: ReadonlySet<string> = new Set(ALL_SYMPTOM_IDS);

/**
 * Chấm điểm nguy cấp.
 *
 * NGUYÊN TẮC
 *   Một nhóm nguy hiểm BẬT LÊN đã đủ để ra `urgent`, không cần tổng điểm. Vì
 *   sao? Vì bệnh viện thú y không khám từ xa được — khi người chủ đang phân
 *   vânh "đi ngay hay đợi mai", con số tổng khiến họ trì hoãn. Chỉ cần một dấu
 *   hiệu đáng ngờ thôi là chạy.
 *
 *   Ngược lại, nếu không nhóm nguy hiểm nào bật: 0 mã thì "không có gì bất
 *   thường", 1–2 mã thì "theo dõi tại nhà", từ 3 mã nhẹ trở lên thì "đặt lịch
 *   trong 24 giờ" — nhiều dấu hiệu nhẹ cộng lại mới đáng lo, một dấu hiệu lẻ
 *   thì thường chỉ là chuyện bữa ăn hôm qua.
 *
 * MÃ LẠ KHÔNG ĐƯỢC TÍNH ĐIỂM
 *   `checked` đến từ UI, nhưng công cụ là hàm thuần nên không giả định ai đó
 *   chỉ truyền mã hợp lệ. Một mã lạ nếu được đếm vào tổng sẽ đẩy kết quả từ
 *   "theo dõi" lên "đặt lịch trong 24 giờ" mà không có bất kỳ dấu hiệu nào.
 */
export function triageScore(checked: readonly string[]): SymptomCheck {
  const selected = checked.filter((id) => KNOWN_IDS.has(id));

  const critical: string[] = [];
  for (const group of CRITICAL_GROUPS) {
    if (group.symptoms.some((id) => selected.includes(id))) {
      critical.push(group.id);
    }
  }

  const count = selected.length;
  // Số nhóm nguy hiểm đã bật không phụ thuộc số mã: tick cả 3 mã "thở" vẫn là
  // MỘT nhóm, nên điểm không được tăng vì người dùng bôi đen cả một hàng.
  const criticalCount = critical.length;

  if (criticalCount > 0) {
    return {
      score: Math.min(100, 60 + criticalCount * 15 + count * 2),
      severity: "urgent",
      critical,
      adviceKey: "tools.checklistUrgent",
    };
  }
  if (count === 0) {
    return { score: 0, severity: "watch", critical, adviceKey: "tools.checklistNone" };
  }
  if (count <= 2) {
    return {
      score: Math.min(55, 15 + count * 12),
      severity: "watch",
      critical,
      adviceKey: "tools.checklistWatch",
    };
  }
  return {
    score: Math.min(85, 35 + (count - 2) * 10),
    severity: "soon",
    critical,
    adviceKey: "tools.checklistSoon",
  };
}

/** Mã có thuộc nhóm nguy hiểm không — UI dùng để tô đậm ô đang tick. */
export function isCriticalSymptom(id: SymptomId): boolean {
  return CRITICAL_IDS.has(id);
}