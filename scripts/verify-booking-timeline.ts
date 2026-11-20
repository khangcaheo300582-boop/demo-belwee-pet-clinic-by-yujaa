// scripts/verify-booking-timeline.ts
// Bảng kiểm cho dòng tiến trình lịch hẹn.
//
// Hàm này chỉ làm một việc: quyết định bước nào đã xong, bước nào đang chờ, bước
// nào không bao giờ xảy ra. Đó đúng loại logic dễ sai mà khó phát hiện bằng mắt:
// nhìn một lịch hẹn huỷ vẫn "có vẻ ổn". Nên mỗi trạng thái của BookingStatus
// được khoá bằng một bảng kỳ vọng tường minh.
//
// TRỌNG TÂM KIỂM: KHÔNG ĐƯỢC BỊA MỐC THỜI GIAN
//   Mô hình dữ liệu không có completedAt/cancelledAt. Test cố tình kiểm rằng
//   những bước đó trả atISO === null — đủ để một lần sửa "tiện" sau này nhả
//   `new Date()` vào chỗ trống bị bắt ngay.
//
// Run with: npx tsx scripts/verify-booking-timeline.ts

import { buildBookingTimeline, type TimelineStep } from '../lib/bookingTimeline';
import { isBookingStatus, normalizeBookingStatus } from '../lib/bookingStatus';
import type { BookingStatus } from '../lib/dbBooking';
import type { MessageKey } from '../lib/i18n';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, why: string) {
  if (ok) {
    passed += 1;
    console.log(`  + ${label}`);
  } else {
    failed += 1;
    console.log(`  x ${label}`);
    console.log(`      ${why}`);
  }
}

const CREATED = '2026-01-10T02:00:00.000Z';
const CONFIRMED = '2026-01-10T05:30:00.000Z';
const SLOT = '2026-01-15T09:00';

/**
 * Bản rút gọn dạng chuỗi: "key:state:T|-".
 *
 * Trả CHUỖI chứ không phải mảng. Bản đầu trả mảng rồi so với chuỗi bằng `===`,
 * khiến 6 phép so sánh luôn false dù nội dung khớp — thứ lỗi test im lặng nhất.
 * Với bảng kỳ vọng dạng văn bản, chuỗi là hình dạng đúng.
 */
function shape(steps: TimelineStep[]) {
  return steps.map(s => `${s.key}:${s.state}:${s.atISO ? 'T' : '-'}`).join(',');
}

function build(status: BookingStatus, over: Partial<Parameters<typeof buildBookingTimeline>[0]> = {}) {
  return buildBookingTimeline({
    status,
    createdAt: CREATED,
    time: SLOT,
    petName: 'Bông',
    serviceType: 'Spa & Grooming',
    ...over,
  });
}

// ── 1. Hình dạng của từng trạng thái ─────────────────────────────────────

console.log('\n1. Hình dạng dòng tiến trình theo từng BookingStatus');

const pending = build('PENDING');
check(
  'PENDING: 3 bước, chưa có bước kết',
  // Bước "xác nhận" ở đây KHÔNG có dấu T — chưa xác nhận thì làm gì có giờ.
  shape(pending) === 'requested:done:T,confirmed:current:-,appointment:upcoming:T',
  `got ${shape(pending)}`,
);
check(
  'PENDING: bước "xác nhận" hiện dòng phụ đang chờ',
  pending[1].detailKey === 'timeline.stepConfirmedPending',
  'thiếu câu "đang chờ phòng khám xác nhận" — bước trông như đã xong',
);
check(
  'PENDING: bước xác nhận CHƯA có giờ',
  pending[1].atISO === null,
  'đang chờ thì không được có mốc thời gian',
);

const confirmed = build('CONFIRMED', { confirmedAt: CONFIRMED, confirmedBy: { name: 'BS Lan' } });
check(
  'CONFIRMED: yêu cầu + xác nhận xong, ngày khám đang tới',
  shape(confirmed) === 'requested:done:T,confirmed:done:T,appointment:current:T',
  `got ${shape(confirmed)}`,
);
check(
  'CONFIRMED: ngày khám là bước "current" chứ không phải "upcoming"',
  confirmed[2].state === 'current',
  'đây là việc khách đang chờ nhất — đánh dấu upcoming là đẩy nó ra xa khỏi mắt',
);
check(
  'CONFIRMED: mang tên người xác nhận',
  confirmed[1].byName === 'BS Lan',
  'mất tên người xác nhận — khách cần biết ai sẽ phụ trách',
);
check(
  'CONFIRMED: không hiện dòng phụ "đang chờ xác nhận"',
  confirmed[1].detailKey === undefined,
  'đã xác nhận rồi mà vẫn nhắc đang chờ là gây lo lắng vô ích',
);

const completed = build('COMPLETED', { confirmedAt: CONFIRMED });
check(
  'COMPLETED: 4 bước, tất cả đã xong',
  shape(completed) === 'requested:done:T,confirmed:done:T,appointment:done:T,closed:done:-',
  `got ${shape(completed)}`,
);
check(
  'COMPLETED: bước kết KHÔNG có mốc thời gian',
  completed[3].atISO === null,
  'mô hình dữ liệu không có completedAt — gán giờ ở đây là bịa dữ liệu',
);

const cancelledEarly = build('CANCELLED');
check(
  'CANCELLED (chưa từng xác nhận): bước xác nhận phải skipped',
  // Bước "ngày khám" vẫn giữ dấu T: khung giờ đã đặt là dữ liệu thật, và việc
  // biết "lịch 15/01 09:00 đã bị huỷ" hữu ích hơn là trống trơn.
  shape(cancelledEarly) === 'requested:done:T,confirmed:skipped:-,appointment:skipped:T,closed:done:-',
  `got ${shape(cancelledEarly)}`,
);
check(
  'CANCELLED sớm: KHÔNG được ghi "đã xác nhận"',
  cancelledEarly[1].state !== 'done',
  'bước chưa từng xảy ra mà bị tô xong — khách tưởng còn được duyệt',
);
check(
  'CANCELLED sớm: ngày khám cũng skipped',
  cancelledEarly[2].state === 'skipped',
  'lịch đã huỷ thì ngày khám không còn ý nghĩa',
);

const cancelledLate = build('CANCELLED', { confirmedAt: CONFIRMED });
check(
  'CANCELLED (sau khi đã xác nhận): bước xác nhận VẪN done',
  shape(cancelledLate) === 'requested:done:T,confirmed:done:T,appointment:skipped:T,closed:done:-',
  `got ${shape(cancelledLate)}`,
);

console.log('\n2. Bước kết chỉ tồn tại khi hồ sơ đã đóng');

for (const status of ['PENDING', 'CONFIRMED'] as BookingStatus[]) {
  const steps = build(status, status === 'CONFIRMED' ? { confirmedAt: CONFIRMED } : {});
  check(
    `${status}: không vẽ sẵn bước kết`,
    steps.every(s => s.key !== 'closed'),
    'vẽ sẵn "Hoàn thành" khi chưa hẹn giờ kết thúc ca là hứa hẹn không có thật',
  );
}

for (const status of ['COMPLETED', 'CANCELLED'] as BookingStatus[]) {
  const steps = build(status, status === 'COMPLETED' ? { confirmedAt: CONFIRMED } : {});
  check(`${status}: có bước kết`, steps.some(s => s.key === 'closed'), 'thiếu bước kết');
}

console.log('\n3. Không bao giờ bịa mốc thời gian');

// Mốc thời gian duy nhất được phép xuất hiện là createdAt, confirmedAt và `time`.
for (const status of ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as BookingStatus[]) {
  const allowed = new Set([CREATED, CONFIRMED, new Date(SLOT).toISOString()]);
  const steps = build(status, { confirmedAt: status === 'PENDING' || status === 'CANCELLED' ? null : CONFIRMED });
  const bogus = steps.filter(s => s.atISO && !allowed.has(s.atISO));
  check(
    `${status}: mọi mốc thời gian đều lấy từ dữ liệu có sẵn`,
    bogus.length === 0,
    `bịa mốc: ${bogus.map(s => `${s.key}=${s.atISO}`).join(', ')}`,
  );
}

console.log('\n4. Chịu được dữ liệu bẩn');

const badTime = build('CONFIRMED', { confirmedAt: CONFIRMED, time: 'không phải ngày' });
check(
  '`time` không parse được thì bước ngày khám có state nhưng atISO null',
  badTime[2].state === 'current' && badTime[2].atISO === null,
  'dữ liệu bẩn phải làm mất GIỜ, không làm mất TRẠNG THÁI',
);

const noConfirmedBy = build('CONFIRMED', { confirmedAt: CONFIRMED });
check(
  'xác nhận nhưng không có tên người xác nhận thì byName null, không phải undefined',
  noConfirmedBy[1].byName === null,
  'undefined và null khác nhau khi so sánh; chuẩn hoá về null',
);

const emptyCreated = buildBookingTimeline({
  status: 'PENDING',
  createdAt: '',
  time: '',
});
check(
  'mọi trường rỗng vẫn trả về dòng bước hợp lệ',
  shape(emptyCreated) === 'requested:done:-,confirmed:current:-,appointment:upcoming:-',
  `got ${shape(emptyCreated)}`,
);

const vnTime = buildBookingTimeline({
  status: 'CONFIRMED',
  createdAt: CREATED,
  confirmedAt: CONFIRMED,
  time: '15/01/2026 09:00',
  petName: 'Miu',
  serviceType: 'Tiêm phòng',
});
check(
  'chuỗi ngày kiểu Việt Nam vẫn ra được mốc thời gian',
  vnTime[2].atISO !== null,
  'form nhập tay gửi dd/MM/yyyy — không đọc được thì mất mốc thời gian',
);

console.log('\n5. Khoá i18n dùng đúng tên');

const validKeys = new Set([
  'timeline.stepRequested',
  'timeline.stepRequestedDetail',
  'timeline.stepConfirmed',
  'timeline.stepConfirmedPending',
  'timeline.stepAppointment',
  'timeline.stepAppointmentDetail',
  'timeline.stepCompleted',
  'timeline.stepCancelled',
]);
const allSteps = [...pending, ...confirmed, ...completed, ...cancelledLate];
// `Boolean(k) &&` KHÔNG đủ để TypeScript thu hẹp kiểu bên trong cùng biểu thức,
// nên lọc thành hai bước: bỏ undefined trước, rồi mới so khoá.
const badKeys = allSteps
  .flatMap(s => [s.labelKey, s.detailKey])
  .filter((k): k is MessageKey => k !== undefined)
  .filter(k => !validKeys.has(k));
check(
  'mọi khoá nhãn đều tồn tại trong i18n',
  badKeys.length === 0,
  `khoá lạ: ${badKeys.join(', ')} — UI sẽ render khoá thay vì nhãn`,
);

console.log(`\n6. Chuẩn hoá trạng thái lịch hẹn`);

// ── KHÔNG THỎA HIỆP ───────────────────────────────────────────────────────────
// Bảng này là hợp đồng với dữ liệu đã nằm sẵn trong data/bookings.json. Trước khi
// viết normalizer dùng chung, /client-portal ép kiểu và lọc theo trạng thái,
// khiến lịch status "ACCEPTED" biến mất khỏi cổng thông tin trong khi màn hình
// nhân viên vẫn thấy. Dòng dưới khoá lại chính xác những từ vựng đó.

const ALIAS_EXPECTATIONS: [string, BookingStatus][] = [
  ['PENDING', 'PENDING'],
  ['CONFIRMED', 'CONFIRMED'],
  ['COMPLETED', 'COMPLETED'],
  ['CANCELLED', 'CANCELLED'],
  // Trạng thái có thật trong data/bookings.json, không nằm trong kiểu cũ.
  ['ACCEPTED', 'CONFIRMED'],
  // Từ vựng dữ liệu cũ / nhập tay.
  ['in_progress', 'CONFIRMED'],
  ['ĐÃ XÁC NHẬN ĐẶT LỊCH', 'CONFIRMED'],
  ['ĐÃ HUỶ', 'CANCELLED'],
  ['huy', 'CANCELLED'],
  ['Hoàn thành', 'COMPLETED'],
];

for (const [raw, expected] of ALIAS_EXPECTATIONS) {
  check(
    `"${raw}" → ${expected}`,
    normalizeBookingStatus(raw) === expected,
    `got ${normalizeBookingStatus(raw)}`,
  );
}

check(
  'chuỗi trắng quanh vẫn nhận diện được',
  normalizeBookingStatus('  confirmed  ') === 'CONFIRMED',
  'dữ liệu nhập tay hay có khoảng trắng thừa',
);

check(
  'giá trị rỗng rơi về PENDING, KHÔNG phải CONFIRMED',
  normalizeBookingStatus('') === 'PENDING' && normalizeBookingStatus(null) === 'PENDING',
  'khẳng định "đã xác nhận" cho dữ liệu không đọc được là nói sai với khách',
);

check(
  'từ vựng lạ rơi về PENDING để nhân viên xử lý được',
  normalizeBookingStatus('WAT') === 'PENDING',
  'bảng alias thiếu một từ và dữ liệu bị đọc sai',
);

// isBookingStatus KHÁC normalizeBookingStatus: nó không nới lỏng, dùng ở biên
// ghi. Nếu nó cũng trả true cho ACCEPTED thì từ vựng lạ lại quay về store.
check(
  'isBookingStatus chỉ chấp nhận đúng 4 trạng thái chuẩn',
  isBookingStatus('ACCEPTED') === false && isBookingStatus('PENDING') === true,
  'biên ghi phải chặn từ vựng lạ, nếu không vòng lặp dữ liệu bẩn bắt đầu lại',
);

check(
  'isBookingStatus từ chối giá trị không phải chuỗi',
  isBookingStatus(42) === false && isBookingStatus(null) === false,
  'type guard phải chịu được giá trị rác từ JSON',
);

// Mọi trạng thái chuẩn đều phải đi qua được chuẩn hoá như mình, không đổi.
for (const s of ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as BookingStatus[]) {
  check(`${s} là bất biến dưới chuẩn hoá`, normalizeBookingStatus(s) === s, `got ${normalizeBookingStatus(s)}`);
}

console.log(`\nbooking-timeline: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
