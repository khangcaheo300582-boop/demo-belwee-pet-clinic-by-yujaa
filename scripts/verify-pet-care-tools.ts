// scripts/verify-pet-care-tools.ts
// Khoá lại toán học của ba công cụ chăm sóc (I2).
//
// BA THỨ ĐƯỢC CỐ Ý KIỂM Ở ĐÂY
//   1. Tính đúng — bảng số chốt cho các ca biên, không chỉ "không NaN".
//   2. Ngưỡng phân loại — đây là phần nguy hiểm nhất. `urgent` cố ý bật khi
//      chỉ MỘT dấu hiệu nguy hiểm xuất hiện, vì bệnh viện thú y không khám từ
//      xa được. Nếu ai đó "tinh chỉnh" cho đỡ báo động thì sẽ có người trì hoãn
//      cấp cứu mà không hề có cảnh báo nào.
//   3. Mọi mã triệu chứng đều có nhãn i18n ở CẢ HAI ngôn ngữ — thiếu thì ô
//      nhãn hiện rỗng, và người dùng chỉ thấy lúc đang dùng chứ không phải lúc
//      review code.
//
// Run with: npx tsx scripts/verify-pet-care-tools.ts

import {
  ALL_SYMPTOM_IDS,
  SYMPTOM_GROUPS,
  dailyPortion,
  humanAgeParts,
  humanAgeYears,
  isCriticalSymptom,
  triageScore,
  type SymptomId,
} from '../lib/petCareTools';
import { translations } from '../lib/i18n';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  + ${label}`);
  } else {
    failed += 1;
    console.log(`  x ${label}${detail ? ` -> ${detail}` : ''}`);
  }
}

function eq(label: string, actual: number, expected: number): void {
  check(label, actual === expected, `got ${actual}, expected ${expected}`);
}

/* ── 1. Quy đổi tuổi ─────────────────────────────────────────────────────── */

console.log('\n1. humanAgeYears — hai giai đoạn');
// Hai năm đầu: chó 12 năm-người mỗi năm, mèo 11.
eq('dog 1y', humanAgeYears('dog', 1), 12);
eq('dog 2y', humanAgeYears('dog', 2), 24);
eq('cat 2y', humanAgeYears('cat', 2), 22);
// Từ năm thứ ba: chó +5 mỗi năm, mèo +4.
eq('dog 3y', humanAgeYears('dog', 3), 29);
eq('dog 10y', humanAgeYears('dog', 10), 64);
// Mèo 10 tuổi ≈ 54, chậm hơn chó cùng tuổi thú.
eq('cat 10y', humanAgeYears('cat', 10), 54);
// Tuổi âm không được sinh ra con số âm.
check('negative age clamps to 0', humanAgeYears('dog', -3) === 0);

// Trần hiển thị: bão hoà ở 99 chứ không nhảy ngược. Bản đầu dùng
// `if (tuổi >= 30) return 30`, khiến chó 29,75 tuổi ra 162,75 rồi rớt về 30
// ở 30 tuổi — hàm không đơn điệu, và mọi con chó trên 3,2 tuổi đều hiện "30".
check('absurd pet age saturates at the display ceiling', humanAgeYears('dog', 99) === 99);
check('saturation is a ceiling, not a fall-back', humanAgeYears('dog', 30) === 99);

// Hàng rào chống hồi quy: nghiên cứu tuổi thọ tương đương cho khoảng 60-72
// năm người với chó 10 tuổi (~66 giống lớn, ~72 giống nhỏ). Công thức "×7 rồi
// cộng 3" cũ cho 73 — quá cao. Ai đổi hệ số mà làm lệch khỏi dải này thì đã
// sai, dù vẫn trông "hợp lý".
check(
  'dog 10y lands inside the researched equivalent-lifespan band (60-72)',
  humanAgeYears('dog', 10) >= 60 && humanAgeYears('dog', 10) <= 72,
  `got ${humanAgeYears('dog', 10)}`
);

// Bất biến: đơn điệu, và mèo không bao giờ già hơn chó ở cùng tuổi thú. Phải
// ĐÚNG về mặt toán học, không thì giao diện tự mâu thuẫn ("mèo già hơn chó ở
// tuổi thú này").
let monotone = true;
for (let y = 0; y < 30; y += 0.25) {
  if (humanAgeYears('dog', y + 0.25) < humanAgeYears('dog', y)) monotone = false;
  if (humanAgeYears('cat', y + 0.25) < humanAgeYears('cat', y)) monotone = false;
  if (humanAgeYears('cat', y) > humanAgeYears('dog', y)) monotone = false;
}
check('monotonic, and cats never out-age dogs', monotone);

console.log('\n2. humanAgeParts — years+months, never a raw decimal');
eq('6-month puppy -> 6 human years', humanAgeParts('dog', 0.5)?.years, 6);
eq('6-month puppy -> no stray months', humanAgeParts('dog', 0.5)?.months, 0);
eq('1.5-year dog -> 18 years', humanAgeParts('dog', 1.5)?.years, 18);
eq('1.5-year dog -> 0 months', humanAgeParts('dog', 1.5)?.months, 0);
// 2,4 năm thú = 24 + 0,4×5 = 26 năm người.
eq('2.4-year dog -> 26 years', humanAgeParts('dog', 2.4)?.years, 26);

// Mọi ca đều ra cặp {năm không âm, tháng 0..9}. Trước đây dùng ×12 cho phần
// thập phân của TUỔI THÚ nên ra 7 năm 6 tháng cho bé 6 tháng — nghe như bé đã
// sống 7 năm.
let partsSane = true;
for (let y = 0; y < 30; y += 0.05) {
  const parts = humanAgeParts('dog', y);
  if (!parts) continue;
  if (parts.years < 0 || parts.months < 0 || parts.months > 9) partsSane = false;
}
check('every part is a non-negative year count plus 0-9 months', partsSane);
check('newborn is 0 months, not negative', (humanAgeParts('dog', 0)?.months ?? -1) === 0);

/* ── 2. Khẩu phần ────────────────────────────────────────────────────────── */

console.log('\n3. dailyPortion — grams per day');
// 12kg chó trưởng thành 36 tháng: 12 × 2,0 = 24.000g
const adultDog = dailyPortion('dog', 12, 36);
eq('12kg adult dog g/day', adultDog.gramsPerDay, 24000);
eq('12kg adult dog meals (2)', adultDog.meals, 2);
eq('per-meal divides the day', adultDog.gramsPerMeal, 12000);

// Chó con < 4 tháng dùng tỉ lệ 3,0×.
eq('2kg puppy g/day', dailyPortion('dog', 2, 2).gramsPerDay, 6000);
// Chó 4-12 tháng 2,5×.
eq('2kg puppy 6m g/day', dailyPortion('dog', 2, 6).gramsPerDay, 5000);
// Mèo trưởng thành 1,1×.
eq('4kg adult cat g/day', dailyPortion('cat', 4, 36).gramsPerDay, 4400);
eq('adult cat gets 3 meals', dailyPortion('cat', 4, 36).meals, 3);
// Béo phì: ×0,8.
eq('overweight adult dog g/day', dailyPortion('dog', 12, 36, true).gramsPerDay, 19200);
// Cân nặng 0 phải không sinh gramsPerDay = 0 (chia 0 khi kéo slider hết cỡ).
check(
  'zero weight clamps to the 0.5kg floor',
  dailyPortion('dog', 0, 36).gramsPerDay > 0,
  `got ${dailyPortion('dog', 0, 36).gramsPerDay}`
);
check('negative weight clamps too', dailyPortion('cat', -5, 36).gramsPerDay > 0);

// Bất biến toàn miền: luôn dương và chia hết ngày.
let portionSane = true;
for (let kg = 0.5; kg <= 90; kg += 0.5) {
  for (const kind of ['dog', 'cat'] as const) {
    for (const months of [1, 3, 6, 12, 60, 240]) {
      const r = dailyPortion(kind, kg, months);
      if (r.gramsPerDay <= 0 || r.gramsPerMeal <= 0) portionSane = false;
      // Sai số làm tròn cho phép tối đa `meals` gram cả ngày.
      if (Math.abs(r.gramsPerMeal * r.meals - r.gramsPerDay) > r.meals) portionSane = false;
    }
  }
}
check('every combination yields a positive, self-consistent portion', portionSane);

// Cân nặng tăng thì lượng ăn không được giảm.
let portionMonotone = true;
for (let kg = 0.5; kg < 90; kg += 0.5) {
  if (dailyPortion('dog', kg + 0.5, 36).gramsPerDay <= dailyPortion('dog', kg, 36).gramsPerDay) {
    portionMonotone = false;
  }
}
check('heavier never means less food', portionMonotone);

/* ── 3. Triage ───────────────────────────────────────────────────────────── */

console.log('\n4. triageScore — one critical sign must already be urgent');
const none: SymptomId[] = [];
const mild: SymptomId[] = ['mild1', 'mild2', 'mild3', 'mild4', 'mild5'];
const allMild = [...ALL_SYMPTOM_IDS].filter((id) => !isCriticalSymptom(id));

eq('no symptoms -> score 0', triageScore(none).score, 0);
check('no symptoms -> watch', triageScore(none).severity === 'watch');
check('no symptoms -> "none" advice', triageScore(none).adviceKey === 'tools.checklistNone');
check('no symptoms -> no critical groups', triageScore(none).critical.length === 0);

// Nhóm nhẹ phải phân biệt được các mức. Nếu mọi mã đều thuộc nhóm nguy hiểm
// thì tick một ô là đã "cấp cứu", và người dùng sẽ bỏ qua cảnh báo.
check('1 mild sign -> monitor at home', triageScore(['mild1']).severity === 'watch');
check('2 mild signs -> monitor at home', triageScore(['mild1', 'mild2']).severity === 'watch');
check(
  '3 mild signs -> book within 24h',
  triageScore(['mild1', 'mild2', 'mild3']).severity === 'soon'
);
check(
  '3 mild signs give "soon" advice, not urgent',
  triageScore(['mild1', 'mild2', 'mild3']).adviceKey === 'tools.checklistSoon'
);
// Dấu hiệu nhẹ KHÔNG BAO GIỜ được phép ra urgent, dù tick cả 8 mã. Đây là
// hàng rào chống việc gọi cấp cứu chỉ vì bé hơi ăn ít.
check('every mild sign ticked still never reaches urgent', triageScore(allMild).severity !== 'urgent');
check(
  'ticking all mild signs does not mark any critical group',
  triageScore(allMild).critical.length === 0
);

// Trường hợp nguy hiểm nhất: MỘT dấu hiệu nguy hiểm phải ra urgent, không cần
// tới ngưỡng điểm. Trì hoãn cấp cứu là hậu quả nặng nhất ở đây.
const singleCritical: SymptomId[] = ['breathing1'];
const urgent = triageScore(singleCritical);
check('ONE breathing sign is already urgent', urgent.severity === 'urgent');
check('urgent reports the group', urgent.critical.includes('breathing'));
check('urgent advice key', urgent.adviceKey === 'tools.checklistUrgent');
check('urgent score stays under 100', urgent.score <= 100 && urgent.score >= 60);

// Hai mã của CÙNG nhóm "thở" chỉ là MỘT nhóm — bôi đen cả hàng không được
// tăng mức độ nghiêm trọng.
const sameGroup = triageScore(['breathing1', 'breathing2']);
check('two signs in one group count as one group', sameGroup.critical.length === 1);
check('a whole group ticked is still urgent', sameGroup.severity === 'urgent');

// Nhiều nhóm nguy hiểm khác nhau cùng lúc: vẫn urgent, và điểm phải cao hơn.
const manyGroups = triageScore(['breathing1', 'gastro1', 'neuro1', 'trauma1']);
check('four critical groups are still urgent', manyGroups.severity === 'urgent');
check('four critical groups outscore one', manyGroups.score > urgent.score);
check('urgent never exceeds 100', manyGroups.score <= 100);

// Điểm phải tăng đơn điệu khi thêm dấu hiệu nhẹ, và luôn nằm trong 0..100.
let scoreSane = true;
let previous = 0;
for (let n = 0; n <= mild.length; n += 1) {
  const r = triageScore(mild.slice(0, n));
  if (r.score < 0 || r.score > 100) scoreSane = false;
  if (n > 0 && r.score < previous) scoreSane = false;
  previous = r.score;
}
check('mild score rises monotonically and stays in 0..100', scoreSane);

// isCriticalSymptom phải khớp với chính danh sách nhóm.
check(
  'isCriticalSymptom matches the group definition',
  isCriticalSymptom('breathing1') && !isCriticalSymptom('mild1')
);

/* ── 4. Nhãn i18n và danh sách ───────────────────────────────────────────── */

console.log('\n5. Every symptom id has a label in BOTH languages');
const en = translations.en.tools.symptoms as Record<string, string>;
const vi = translations.vi.tools.symptoms as Record<string, string>;
let labelProblems = 0;
for (const id of ALL_SYMPTOM_IDS) {
  if (!en[id]) {
    labelProblems += 1;
    console.log(`  x en.${id} is missing or empty`);
  }
  if (!vi[id]) {
    labelProblems += 1;
    console.log(`  x vi.${id} is missing or empty`);
  }
}
check(
  `${ALL_SYMPTOM_IDS.length} symptom ids are all translated`,
  labelProblems === 0,
  `${labelProblems} problem(s)`
);

// Mỗi nhóm phải khác nhau và không rỗng, nếu không UI hiển thị mục rác.
check('no empty group', SYMPTOM_GROUPS.every((group) => group.symptoms.length > 0));
check(
  'group ids are unique',
  new Set(SYMPTOM_GROUPS.map((group) => group.id)).size === SYMPTOM_GROUPS.length
);
check(
  'symptom ids are unique',
  new Set(ALL_SYMPTOM_IDS).size === ALL_SYMPTOM_IDS.length,
  `${ALL_SYMPTOM_IDS.length} ids, ${new Set(ALL_SYMPTOM_IDS).size} unique`
);
check(
  'every group has at least one mild or critical sign declared',
  SYMPTOM_GROUPS.some((group) => group.critical) &&
    SYMPTOM_GROUPS.some((group) => !group.critical)
);

// Mã lạ không được tính vào điểm: `checked` đến từ UI nhưng đây là hàm thuần,
// không giả định ai đó chỉ truyền mã hợp lệ. Một mã lạ nếu được đếm sẽ đẩy
// kết quả từ "theo dõi" lên "đặt lịch trong 24 giờ" mà không có dấu hiệu nào.
check('triageScore ignores ids that are not in the list', triageScore(['notARealSymptom']).score === 0);
check('a stray id does not fake a higher severity', triageScore(['notARealSymptom']).severity === 'watch');
check(
  'stray ids cannot reach urgent',
  triageScore(['notARealSymptom', 'alsoFake']).severity !== 'urgent'
);

// Danh sách mã phải phủ đúng khoá i18n — thêm mã quên khoá dịch thì lệch.
const known = new Set<string>(ALL_SYMPTOM_IDS);
check('known ids are exactly the i18n keys', known.size === Object.keys(en).length);
check('no i18n key is orphaned', Object.keys(en).every((id) => known.has(id)));

console.log(`\npet-care-tools: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);