// lib/emailTemplates.ts
// Mẫu HTML email chuyên nghiệp cho hệ thống đặt lịch
// FIXED: Exact button labels per state machine spec, correct email flow

import { Booking } from './dbBooking';

// ─── Palette & Style chung ──────────────────────────────────────────
const BASE_STYLE = `
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 600px; margin: 0 auto;
  background-color: #f8fafc; border-radius: 16px; overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
`;

const HEADER_GRADIENT = `background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #0ea5e9 100%); color: white; padding: 28px 24px; text-align: center;`;

const INFO_BOX = `background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 18px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; line-height: 1.7; font-size: 14px; color: #1e293b;`;

const FOOTER = `<div style="padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
  © ${new Date().getFullYear()} Belwee Pet Clinic · Email tự động, vui lòng không trả lời trực tiếp.
</div>`;

function infoRow(label: string, value: string, color?: string) {
  return `<p style="margin: 4px 0;"><strong>${label}:</strong> <span style="${color ? `color:${color}; font-weight:bold;` : ''}">${value}</span></p>`;
}

// ─── Template 1: Gửi Admin (chứa nút "Xác Nhận Đặt Lịch") ────────────────────────────────────────
// This email is sent on booking CREATION (State: PENDING)
export function buildAdminEmail(booking: Booking, confirmUrl: string) {
  return {
    subject: `🚨 [ĐẶT LỊCH MỚI] ${booking.serviceType} — ${booking.customerName} (#${booking.id})`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0; padding:20px; background:#eef2f7;">
<div style="${BASE_STYLE}">
  <div style="${HEADER_GRADIENT}">
    <h2 style="margin:0; font-size:20px; letter-spacing:0.5px; font-weight:800;">🐾 LỊCH HẸN MỚI CHỜ XÁC NHẬN</h2>
    <p style="margin:8px 0 0; font-size:13px; opacity:0.85;">Hệ thống Belwee Pet Clinic vừa tiếp nhận yêu cầu đặt lịch trực tuyến.</p>
  </div>
  <div style="padding: 24px; color: #1e293b;">
    <p style="font-size:14px;">Chào Ban quản trị, dưới đây là chi tiết phiếu đặt lịch:</p>
    <div style="${INFO_BOX}">
      ${infoRow('Mã lịch hẹn', `#${booking.id}`, '#2563eb')}
      ${infoRow('Họ tên khách', booking.customerName)}
      ${infoRow('Email', booking.customerEmail)}
      ${infoRow('Số điện thoại', booking.customerPhone)}
      ${infoRow('Tên thú cưng', booking.petName)}
      ${infoRow('Loại thú cưng', booking.petType || 'Chưa ghi nhận')}
      ${infoRow('Dịch vụ', booking.serviceType, '#1e3a8a')}
      ${infoRow('Thời gian hẹn', booking.time, '#e11d48')}
      ${booking.addressName ? infoRow('Chi nhánh', booking.addressName) : ''}
      ${infoRow('Ghi chú', booking.notes || 'Không có')}
    </div>
    <p style="text-align:center; font-size:13px; color:#64748b; margin-top:28px;">Kiểm tra lịch trống, sau đó nhấn nút bên dưới để xác nhận:</p>
    <div style="text-align:center; margin:24px 0;">
      <a href="${confirmUrl}" style="background-color:#10b981; color:white; padding:16px 40px; text-decoration:none; border-radius:12px; font-weight:bold; font-size:16px; display:inline-block; box-shadow:0 4px 14px rgba(16,185,129,0.35); letter-spacing:0.5px;">
        ✅ Xác Nhận Đặt Lịch
      </a>
    </div>
    <p style="text-align:center; font-size:11px; color:#94a3b8;">⚠️ Nút xác nhận chỉ có hiệu lực 1 lần. Link hết hạn sau 72 giờ.</p>
  </div>
  ${FOOTER}
</div>
</body></html>`,
  };
}

// ─── Template 2: Gửi Khách hàng (thông báo ĐÃ XÁC NHẬN ĐẶT LỊCH) ────────────────────────────────────────
// This email is sent ONLY after admin confirms (State: CONFIRMED)
export function buildCustomerEmail(booking: Booking) {
  return {
    subject: `✅ Đã Xác Nhận Đặt Lịch — Mã #${booking.id} | Belwee Pet Clinic`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0; padding:20px; background:#eef2f7;">
<div style="${BASE_STYLE}">
  <div style="${HEADER_GRADIENT}">
    <h2 style="margin:0; font-size:20px; letter-spacing:0.5px; font-weight:800;">🎉 ĐÃ XÁC NHẬN ĐẶT LỊCH!</h2>
    <p style="margin:8px 0 0; font-size:13px; opacity:0.85;">Lịch hẹn của bạn tại Belwee Pet Clinic đã được xác nhận chính thức.</p>
  </div>
  <div style="padding: 24px; color: #1e293b;">
    <p style="font-size:14px;">Xin chào <strong>${booking.customerName}</strong>, phòng khám Belwee đã <strong style="color:#10b981;">xác nhận</strong> lịch hẹn của bạn. Dưới đây là thông tin chi tiết:</p>
    <div style="${INFO_BOX}">
      ${infoRow('Mã lịch hẹn', `#${booking.id}`, '#2563eb')}
      ${infoRow('Dịch vụ', booking.serviceType, '#1e3a8a')}
      ${infoRow('Tên thú cưng', booking.petName)}
      ${infoRow('Thời gian hẹn', booking.time, '#e11d48')}
      ${booking.addressName ? infoRow('Chi nhánh', booking.addressName) : ''}
    </div>
    <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:12px; padding:16px 20px; margin:20px 0; text-align:center;">
      <p style="margin:0; font-size:14px; color:#065f46; font-weight:600;">📞 Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất để chốt lịch hẹn chi tiết.</p>
    </div>
    <p style="font-size:13px; color:#64748b;">Nếu cần thay đổi thời gian, vui lòng gọi trực tiếp: <strong>0772 003 915</strong></p>
  </div>
  ${FOOTER}
</div>
</body></html>`,
  };
}

// ─── Template 3: Nhắc lịch hẹn sắp diễn ra (cron: T+2 ngày) ────────────────────────────────────────
export function buildReminderEmail(input: {
  petName: string;
  petType?: string;
  service: string;
  timeLabel: string;
  bookingId: string;
}) {
  return {
    subject: `⏰ Nhắc lịch: ${input.service} cho bé ${input.petName} tại Belwee Pet Clinic`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0; padding:20px; background:#eef2f7;">
<div style="${BASE_STYLE}">
  <div style="${HEADER_GRADIENT}">
    <h2 style="margin:0; font-size:20px; letter-spacing:0.5px; font-weight:800;">🐾 NHẮC LỊCH HẸN SẮP TỚI</h2>
    <p style="margin:8px 0 0; font-size:13px; opacity:0.85;">Lịch hẹn của bé <strong>${input.petName}</strong> chỉ còn 2 ngày nữa.</p>
  </div>
  <div style="padding: 24px; color: #1e293b;">
    <p style="font-size:14px;">Xin chào, Belwee xin nhắc bạn về lịch hẹn đã xác nhận sắp diễn ra:</p>
    <div style="${INFO_BOX}">
      ${infoRow('Mã lịch hẹn', `#${input.bookingId}`, '#2563eb')}
      ${infoRow('Thú cưng', `${input.petName}${input.petType ? ` (${input.petType})` : ''}`)}
      ${infoRow('Dịch vụ', input.service, '#1e3a8a')}
      ${infoRow('Thời gian hẹn', input.timeLabel, '#e11d48')}
    </div>
    <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:12px; padding:16px 20px; margin:20px 0; text-align:center;">
      <p style="margin:0; font-size:14px; color:#065f46; font-weight:600;">
        💡 Vui lòng cho bé nhịn ăn nhẹ 4-6 tiếng trước khi khám (nếu có xét nghiệm máu) và mang theo sổ tiêm phòng nếu có.
      </p>
    </div>
    <p style="font-size:13px; color:#64748b;">Cần đổi lịch? Gọi ngay <strong>0772 003 915</strong> để được hỗ trợ.</p>
  </div>
  ${FOOTER}
</div>
</body></html>`,
  };
}

// ─── Template 4: Gửi Khách ngay khi đặt lịch (PENDING — "đang chờ xác nhận") ──
// Gửi ngay sau khi booking được tạo, TRƯỚC khi admin xác nhận.
// Mục đích: Khách biết phòng khám đã nhận yêu cầu, không lo lắng chờ đợi.
export function buildCustomerPendingEmail(booking: Booking) {
  return {
    subject: `📋 Đã nhận lịch hẹn của bạn — Mã #${booking.id} | Belwee Pet Clinic`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0; padding:20px; background:#eef2f7;">
<div style="${BASE_STYLE}">
  <div style="${HEADER_GRADIENT}">
    <h2 style="margin:0; font-size:20px; letter-spacing:0.5px; font-weight:800;">🐾 ĐÃ NHẬN YÊU CẦU ĐẶT LỊCH</h2>
    <p style="margin:8px 0 0; font-size:13px; opacity:0.85;">Cảm ơn bạn đã tin tưởng Belwee Pet Clinic!</p>
  </div>
  <div style="padding: 24px; color: #1e293b;">
    <p style="font-size:14px;">Xin chào <strong>${booking.customerName}</strong>,</p>
    <p style="font-size:14px; color: #374151;">Chúng tôi đã nhận được yêu cầu đặt lịch của bạn và đang xem xét lịch trống. Đội ngũ Belwee sẽ <strong style="color:#2563eb;">liên hệ xác nhận trong vòng 30 phút</strong> trong giờ làm việc.</p>
    <div style="${INFO_BOX}">
      ${infoRow('Mã yêu cầu', `#${booking.id}`, '#2563eb')}
      ${infoRow('Thú cưng', booking.petName + (booking.petType ? ` (${booking.petType})` : ''))}
      ${infoRow('Dịch vụ', booking.serviceType, '#1e3a8a')}
      ${infoRow('Thời gian mong muốn', booking.time, '#e11d48')}
      ${booking.addressName ? infoRow('Chi nhánh', booking.addressName) : ''}
    </div>
    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:16px 20px; margin:20px 0;">
      <p style="margin:0; font-size:13px; color:#1d4ed8; font-weight:600;">📞 Cần hỗ trợ gấp? Gọi ngay: <a href="tel:0772003915" style="color:#1d4ed8;">0772 003 915</a></p>
      <p style="margin:6px 0 0; font-size:12px; color:#3b82f6;">Giờ làm việc: 8:00 – 20:00 · Thứ 2 – Chủ nhật</p>
    </div>
    <p style="font-size:12px; color:#94a3b8; text-align:center;">Bạn sẽ nhận thêm email xác nhận chính thức sau khi lịch hẹn được duyệt.</p>
  </div>
  ${FOOTER}
</div>
</body></html>`,
  };
}
