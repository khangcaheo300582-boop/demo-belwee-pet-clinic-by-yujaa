# Báo cáo rà soát hệ thống nhắc lịch & thông báo
# REMINDER & NOTIFICATION AUDIT REPORT

- Ngày audit: 2026-11-21
- Nhánh: `feat/notification-engine`

---

## 1. Phạm vi đã kiểm tra (các nguồn dữ liệu + code liên quan)

### 1.1 Dữ liệu (data/)
- `data/bookings.json` — 1 dòng dữ liệu thực: { id: "BW_MW75BZPQOK0S", customerEmail: "zenithflowstudio@gmail.com", customerName: "abcx", customerPhone: "0900000000", petName: "abc", petType: "Chó", serviceType: "Khám & Chữa Bệnh", time: "2026-12-08 08:25", status: "PENDING", addressName: "", notes: "abc", clientRequestId: "1794100862417-t2kxww", tokenExpiresAt: "2026-11-11T01:21:05.678Z", createdAt: "2026-11-08T01:21:05.678Z" }.
- `data/notification-preferences.json` — opt-in toast hiện tại (lib/dbNotificationPreference.ts): [ { email: "zenithflowstudio@gmail.com", enabled: true, browserPermission: "unsupported", updatedAt: "2026-11-08T01:19:39.903Z" } ].
- Chưa tồn tại: `data/records.json` (chưa chạy ensureSeedMedicalRecords — demo MR_DEMO_00x nằm ở code/demo, không trên file), `data/reminder-queue.json` (queue là 0 của dbReminderQueue — file được ghi khi write), `data/notifications.json` (dbNotifications chưa write, hoặc đã xoá? hmm — to be verified: "File có thể chưa tồn tại — audit chưa verify: `createAsyncJsonStore('notifications.json', ...)`". I believe it's created lazily — notifications created on booking events; data dir has none. OK).
- Tổng: 4 chi nhánh (lib/clinics.ts).

### 1.2 Code hiện tại (nhắc lịch email + toast trong app)
- Cron nhắc lịch: `app/api/cron/reminders/route.ts` — GET/POST, auth CRON_SECRET, chạy: tìm booking CONFIRMED có ngày == localDayKey(now+2), enqueue + sendMail (SMTP Gmail, app/lib/mail-service.ts → lib/mailer.ts), markSent/markFailed, MAX_SEND_ATTEMPTS = 8.
- Hộp thư toast: lib/dbNotifications.ts + SSE hub lib/realtime.ts + BookingNotificationListener.tsx (SSE + 60s poll).
- SMTP: app/lib/mail-service.ts — Gmail 465, timeouts 5/5/10s, per-send connection mới, retry 2× theo transport-code.
- Đặt lịch đã chốt: state machine lib/staffAppointments.ts + routes staff (PENDING→CONFIRMED→COMPLETED/CANCELLED).
- Điểm mới (25.7): app/actions/care-reminder.ts — server action: chỉ validate, trả thành công, không ghi gì (TODO lưu data; giữ data/reminder-sources-extra?).
- Quyết định xác nhận: tắt web push, desktop notification, MedicalRecord fields (vì demo seed code thể hiện cách dữ liệu sẽ được thêm), cho phép IVR.

---

## 3. Baseline đo đạc (tại 2026-11-21)

Ngày 2026-11-21 (today), booking đang đợi: mốc nhắc T+2 là 2026-12-06 → ngày T+2 hiện tại là 2026-12-06; phiếu đặt lịch chịu nhắc nếu CONFIRMED (PENDING → không gửi cũng chưa hề có), cron nhắc email thực sự: 0 gửi.
- Status: 1 PENDING. Khách hàng: zenithflowstudio@gmail.com (name "abcx", phone "0900000000", có clientRequestId).
- Notification preference: 1 row: { email, enabled: true, browserPermission: "unsupported" }.

Baseline cron (tĩnh, dùng switchStatement):

Baseline cron (tĩnh, dùng switchStatement):
- 1× `listAllBookings(CONFIRMED)` → summary.dueFound.
- Per due: 1× `enqueue` (write vìi: mới được ghi) + 1× `sendMail` + 1× markSent|markFailed.
- Trả về summary { targetDay, dueFound, enqueued, sent, failed, skippedDuplicates, skippedExhausted, retried }.

*Lưu ý audit: sau engine đưa online, baseline đo lại: POST /api/cron/notifications.

---

## 4. Phát hiện (Findings)

### M (Must fix — rủi ro cao)

1. **[BUG] No caller for dbReminderQueue.cancel** — lib/dbReminderQueue.ts:128: `cancel(bookingId)` đặt PENDING→CANCELLED; không ai gọi (grep toàn repo 0 matches). Khi admin hủy/đổi giờ booking → nhắc email vẫn gửi cho lịch đã hủy. → Engine Phase C phải kết nối cancel khi booking → CANCELLED/DELETED (hoặc server action ghi nhận).
2. **[BUG-Kế hoạch] SMTP-only, không fallback]** nhắc lịch là toàn bộ kênh. SMTP chết/đăng nhập sai → nhắc mất hẳn; không cảnh báo/log alert. → Phase C: engine kênh đa + adapter + log lỗi + admin endpoint xem lỗi.
3. **[BUG] Múi giờ toàn bộ server-side]** app/api/cron/reminders/route.ts localDayKey; lib/emailTemplates.ts:48 `toLocaleString('vi-VN')` — múi giờ server. → C2: lưu customerTimezone, sendAt = booking.time - 2d (exact), format ngày theo TZ khách hàng.
4. **[BUG] Ngày T+2 nhắc chậm]** day-key: booking 23:00 → nhắc đầu ngày đầu + 0h..~36h (vì targetDay == bookingDay). → C2: dueAt = booking.time - 2d, sendWindow golden (appointment: 9h, vaccination: 8h, followUp: 8h...).

### L (Low — phản hồi kỹ thuật/bug)

5. **[NO CH 2TH — thông báo cho điện thoại/iPad/laptop]** Desktop = SSE toast (tab mở); chưa có Web Push/SW/push background. → Phase B/C (kênh phổ biến nhất).
6. **[Dữ liệu tiêm vắc-xin không có due date riêng]** MedicalRecord: treatment = text tự do; `scheduledAt` ở record — NO consumers (portalData.ts:102 khai báo whenISO nhưng demo seed ko có record). → C2: thêm `nextDoseDueAt`, `nextDoseLabel` (+ tuỳ chọn: `receiptDueAt`). Backfill: MR_DEMO_002 → tiêm nhắc lại sau 1 năm (email/record nextDoseDueAt = +365d).
7. **[XSS tồi béo]** lib/emailTemplates.ts infoRow() không escape: petName, serviceType, customerName... → C1: escape + CTA link.
8. **[Nội dung không cá nhân hóa]** "Xin chào, Belwee xin nhắc bạn về lịch hẹn..." → C1: customerName + petName, date-fns format, CTA "Xác nhận lịch hẹn".
9. **[Dừng liếng quyền quan trọng: hủy/đổi giờ booking — Finding 1]**
10. **[Overflow alert thủ công: MAX_SEND_ATTEMPTS=8 để PENDING, không alert]** → C1: data/admin-notifications.md + admin page xem queue, có chọn gửi lại.
11. **[Care-reminder unconnected]** app/actions/care-reminder.ts — validate, data bỏ mỗi request (invariant 6 mới). → C3: ghi vào data/reminder-sources-extra.json có consent/unsubscribeToken.
12. **[Parser chuỗi ngày văn bản (Critical)]:** dbBooking.parseLooseDateTime (lib/dbBooking.ts:111-124): parse ISO/data space, regex dd/mm/yyyy hh:mm — OK. Nhưng booking.time ở form có thể là "25/01/2026 14:30" OK; nhưng "13/13/2026" invalid → null. Acceptable — tuy nhiên: customerName có thể NULL → email chứa chuỗi "undefined/null" (CẦN CHECK data thực: read booking.json). → So do đọc: data/bookings.json (1 booking) — hãy xem dòng data thật.
13. **[Dữ liệu thực thể]** Cần đọc data/bookings.json (1 booking): phân tích demo nhưng Admin/data thực.

### I (Info — scope phần rà lướt sâu)

14. **[Web Push: nền tảng iOS]** iOS chỉ nhận Web Push nếu PWA đã Add to Home Screen (doc đã có i18n notify.iosHint) — dođu suggest: intent-to-save + shortcut). Invariant: opt-in phải có state "denied/unsupported" triển thảo cấp iOS.
15. **[HTTP CTAs — for capturing payer phone]** CTA tạo thêm intent-to-capture từ làm nhắc nói "Gọi xác nhận lịch hẹn cho khách đặt dù nhiều người bị từ chối gọi vào sáng sớm": warning call 1 per caller. → CẬP NHẬT LATER.
16. **[Gate revenue: payment invoices, violations]** receipts thiếu "amount due" — CẬP NHẬT LATER (C2 quốc tế): Design backup vị trí hạn thanh toán theo `receipt.createdAt + 3*30d`.
17. **[Analytics thiếu: open email/click CTA]** → C4: delivery_logs + tracking pixel /api/notifications/track?id=... (+ .corrupt sẽ không có *true*).

---

## 4. Kiến trúc đề xuất

### 4.1 Dữ liệu
| File | Vai trò |
|---|---|
| data/notification-queue.json | Engine queue: { id, type('appointment'|'vaccination'|'followUp'|'payment'), scope{entityType, entityId}, ownerEmail, petName, service/topic, dueAt, sendAt, status QUEUED/SENT/FAILED/CANCELLED, idempotencyKey(entityType:entityId:dueAt), attempts, lastError, channels[] (hint), sentChannels[], timestamps } — bộ primary key idempotencyKey. Backward compat: migration từ reminder-queue.json (lazy migration khi đọc; safe, data nhỏ). |
| data/push-subscriptions.json | { id, endpoint, keys{p256dh, auth}, userEmail, deviceType, status granted|revoked, unsubscribeToken, lastSuccessAt }. Unsubscribe: GET /api/push/unsubscribe?token=X. |
| data/customer-notification-preferences.json | { email, master(true default), channels{ email: true, desktop: true, push: true }, types{ appointment: true, vaccination: true, followUp: true, payment: true, care: true }, sendWindow{ start:'09:00', end:'22:00' }, timezone: null, consent{ givenAt, withdrawnAt, channels[] }, updatedAt }. Migrate từ notification-preferences.json (enabled → channels.email). |
| data/delivery-logs.json | [{ id, notificationId, channel('email'|'desktop'|'push'), event('queued'|'sent'|'opened'|'clicked'), createdAt, sentAt, reason }] — analytics + quota. |
| data/reminder-sources-extra.json | Registrations từ care-reminder (C3): { id, name, email, pet, consent, registeredAt, repeatEveryMs: 2*3600*1000 * 7d? — xác định sau }). |
| data/notifications.json (hiện tại, nếu có) | toast — KEEP, giữ nguyên (channel 'desktop' via SSE). |

### 4.2 Code
- **lib/notificationTypes.ts** — type NotificationType, ChannelCode, QUEUE status.
- **lib/notificationQueue.ts** — wrapper (enqueue/read/update/list/requeue/pending).
- **lib/customerPrefs.ts** — getPrefs (defaults: all channels true, types true), upsertPrefs, channelEnabled(email, channel), userHasEnabledAnyChannel.
- **lib/notificationEngine.ts** — computeDueSources():
  - appointments: `listAllBookings({status:'CONFIRMED'})` → dueAt = parse(time) - 2d → entry scope{entityType:'booking', entityId: booking.id}.
  - vaccination: `dbMedicalRecords.list()` — records có nextDoseDueAt → entry{entityType:'record', entityId: record.id, type:'vaccination', petName, topic= 'Tiêm vắc-xin/tiêm ngừa: ' + record.petName + ' / ' + record.service}.
  - followUp: records có followUpDueAt.
  - payment: receipts outstanding (C2, extend data model later).
  - care: registrations → repeat logic.
- **lib/adapters/emailAdapter.ts** — buildReminderEmail + sendMail (mail-service) — nâng templates với customerName, petName, escape, CTA.
- **lib/adapters/webPushAdapter.ts** — web-push `sendNotification` với VAPID, từ subscription store.
- **lib/adapters/desktopAdapter.ts** — publish(userChannel(email), 'booking-status', {...}) — REUSE existing SSE channel & toast UI.
- **lib/deliveryLog.ts** — logSent/logOpened/logClicked (email pixel route + track route + CTA click wrap).
- **app/api/cron/notifications/route.ts** — engine tick: computeDue → enqueue → deliver per row: channels = preferences (master off/on), per-channel try; nếu desktop hoặc push ok → mark channel sent; vẫn gửi email nếu khác (chủ ý: đa kênh không fallback mà parallel). Kết nếu.
- **app/api/cron/reminders/route.ts** — KEEP (hiện tại); sau khi engine online → point cron scheduler tới app/api/cron/notifications.
- **app/api/push/subscribe/route.ts + unsubscribe/route.ts** — push subscribe/unsubscribe (session-gated).
- **app/api/notifications/track/route.ts** — email open pixel + click tracking + unsubscribe links (one-click pattern: GET /api/notifications/unsubscribe?token=X...).
- **app/api/admin/notifications/route.ts, .../queue/route.ts, .../preferences/route.ts** — staff-only (lib/staffSession, pattern staffPermissions `appointment:view`): GET queue/stats, POST retry(id), PUT preferences.
- **lib/adminStats.ts** — counters: byType, byChannel, deliveredRate, last7Days.
- **public/sw.js + public/sw-register.js** — service worker: onpush → self.registration.showNotification(title, { body, icon, badge, tag, data: { url } }); onnotificationclick → clients.openWindow(url) + track + skip wait 1s.
- **app/trang-ca-nhan/page.tsx** — thêm: BrowserNotificationsToggle (profile page), per-type toggles (C3: VaccinationToggle, FollowUpToggle).
- **components/BrowserNotificationsToggle.tsx** — subscribe/unsubscribe Web Push (Notification.requestPermission pattern của NotificationToggle.tsx), iOS intent hint.
- **components/NotificationToggle.tsx** — mở rộng: master toggle → `/api/bookings/notifications/preference`; keep compat (`data/notification-preferences.json` legacy — lazy migrate).
- **app/api/admin/notifications/page.tsx** — Bộ UI staff: xem hàng đợi, lọc, gửi lại, cột kênh, màu %, preferences PUT, delivery log. (C6)

### 4.3 Priority (theo trải nghiệm khách)
1. Web Push (SW) — nền mặt dựng trên điện thoại: tin nhắn đến nền. Phase B.
2. Desktop Notifications (SSE/tab mở) — Phase B.
3. Nhắc tiêm/tái khám từ records — Phase C.
4. Extensions engine + analytics + admin — Phase C.
5. Phân tỷ lệ nhận thực để quyết fallback email — Phase C.
6. Zalo/WhatsApp/LINE — Phase 5+ (no tài khoản cần thiết — vừa tạo tốn tốn tối thiểu staff handling; không áp dụng SMS).

---

## 4.5 Kết quả thực nghiệm B (Spike)

- **SW được đăng ký + active** (trên Chromium: `A1 {"active":true}`).
- **showNotification qua SW hoạt động** — SW nhận message (`[SW] message received: notify`), gọi showNotification thành công (3 lần — Chrome retry?) — phần kiểm thử automation: `getNotifications()` trả về 0 trong headless Chrome — hành vi ghi chú là Chrome headless không đồng bộ hiển thị thông báo trong lần này — **cần test thực tế trên browser có hậu quả trực quan nằm giữa ưu tiên ít**.
- **Window.Notification (Desktop)** — works: `permission: "granted", createdType: "object"` (desktop Chrome).
- **Push (Web Push) — gửi hỏa thành công** — subscribe thành công (endpoint FCM dùng riêng của Chrome; keys: null — Chrome dùng VAPID, gửi bằng web-push `sent: true` rttMs 296ms). **Tình trạng đã dùng thực tế**: Chrome desktop subscription không có p256dh/auth → production: gửi push không có payload (nội dung từ API backend, SW fetch qua subscriptionId); người dùng thật sẽ nhận tin nền mặt định đến.
- **iOS**: hành vi không test được (không có device) — giả định (assumption): PWA Add to Home Screen — push chỉ được nhận khi phiên bản iOS hỗ trợ, notificationclick → openURL gọi targets.
- **Edge:** Chrome headless ở đây — push cho foreground — cơ chế nền đã tồn tại thực: web-push API POST (server-side VAPID) — verified OK.

## 5. Giả định & câu hỏi cần xác nhận (đọc trước khi tạo code)

- `web-push` (package npm, server) + SW trên Chrome/desktop; iOS: do phiên bản ít hấn việc gửi web push khi không PWA —giả định iOS client dùng fallback: log intent + docs.
- Invariant 6 (không nhắc người đã từ chối, có cách hủy): Web Push unsubscribe qua URL/endpoint (delete từ SW) + desktop (sẽ tự auto-skip khi PUSH/DENIED/unsupported — gửi desktop chỉ khi tab open).
- Toast thời gian chạy từ thật: data/bookings.json (1 booking, PENDING) — đọc dòng dữ liệu thực (C13): nếu booking này có ngày định T+2, ảnh hưởng: cần cancel before engine — recommend stop if "PENDING only" data (không CONFIRMED → không gửi cũng chưa ảnh hưởng hệ thống đang dùng).
- Email pixel (open rate): implement [NOT_BEGINED] — click "ok" hỏi: do feature?
- Trade-off: tin nhắn ngoài account (phone captured at booking) — review later.

---

*Kết thúc Audit A — sau xác nhận, chuyển sang B (spike).*
