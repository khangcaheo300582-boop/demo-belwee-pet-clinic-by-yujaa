// app/api/xac-nhan/route.ts
// API: Xử lý xác nhận lịch hẹn từ email
//  - GET  : Hiển thị landing page trung gian (chống bot quét link tự click)
//  - POST : Xác nhận token → cập nhật CSDL PENDING→CONFIRMED → gửi email cho khách

import { NextResponse } from 'next/server';
import { dbBooking } from '@/lib/dbBooking';
import { sendMail } from '@/lib/mailer';
import { buildCustomerEmail } from '@/lib/emailTemplates';
import { readJsonBody } from '@/lib/validators';

// ──────────────────────────────────────────────────────────────
// GET: Landing page trung gian - chỉ hiển thị thông tin + nút xác nhận
// Bot quét email sẽ GET link nhưng KHÔNG thay đổi trạng thái (single-use token)
// ──────────────────────────────────────────────────────────────
// Escape HTML entities to prevent XSS via booking data fields
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Các trường booking được đọc khi dựng landing page xác nhận.
 * Mọi giá trị đều đi qua String(...) + escapeHtml(...) nên kiểu là `unknown`:
 * không ép kiểu cụ thể trước khi render, tránh tin nhầm vào dữ liệu JSON.
 */
type RenderableBooking = Partial<Record<
  'id' | 'customerName' | 'customerPhone' | 'petName' | 'serviceType' | 'time',
  unknown
>>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  // Trang HTML nhẹ - inline CSS, không phụ thuộc tailwind
  const renderPage = (state: 'valid' | 'invalid' | 'confirmed' | 'cancelled', booking?: RenderableBooking) => {
    const titleMap: Record<string, string> = {
      valid: 'Xác Nhận Đặt Lịch',
      invalid: 'Liên Kết Không Hợp Lệ',
      confirmed: 'Lịch Hẹn Đã Xác Nhận',
      cancelled: 'Lịch Hẹn Đã Huỷ',
    };
    const iconMap: Record<string, string> = {
      valid: '📋',
      invalid: '❌',
      confirmed: '✅',
      cancelled: '🚫',
    };

    let body = '';
    if (state === 'valid' && booking) {
      body = `
        <div class="info-card">
          <div class="info-row"><span class="label">Mã lịch hẹn:</span> <span class="value id">#${escapeHtml(String(booking.id))}</span></div>
          <div class="info-row"><span class="label">Khách hàng:</span> <span class="value">${escapeHtml(String(booking.customerName))}</span></div>
          <div class="info-row"><span class="label">Số điện thoại:</span> <span class="value">${escapeHtml(String(booking.customerPhone))}</span></div>
          <div class="info-row"><span class="label">Thú cưng:</span> <span class="value">${escapeHtml(String(booking.petName))}</span></div>
          <div class="info-row"><span class="label">Dịch vụ:</span> <span class="value">${escapeHtml(String(booking.serviceType))}</span></div>
          <div class="info-row"><span class="label">Thời gian:</span> <span class="value danger">${escapeHtml(String(booking.time))}</span></div>
        </div>
        <p class="hint">Vui lòng nhấn nút bên dưới để hoàn tất xác nhận. Token này chỉ có hiệu lực 1 lần.</p>
        <button id="confirmBtn" class="btn-confirm" onclick="doConfirm()">✅ Xác Nhận Đặt Lịch</button>
        <div id="status" class="status"></div>`;
    } else if (state === 'confirmed' && booking) {
      body = `
        <div class="badge success">✅ Lịch hẹn <strong>#${escapeHtml(String(booking.id))}</strong> đã được xác nhận thành công!</div>
        <div class="info-card">
          <div class="info-row"><span class="label">Khách hàng:</span> <span class="value">${escapeHtml(String(booking.customerName))}</span></div>
          <div class="info-row"><span class="label">Dịch vụ:</span> <span class="value">${escapeHtml(String(booking.serviceType))}</span></div>
          <div class="info-row"><span class="label">Thời gian:</span> <span class="value danger">${escapeHtml(String(booking.time))}</span></div>
        </div>
        <p class="hint">Email thông báo đã được gửi tới khách hàng. Bạn có thể đóng trang này.</p>`;
    } else if (state === 'cancelled') {
      body = `<div class="badge invalid">🚫 Lịch hẹn này đã bị huỷ và không thể xác nhận.</div>`;
    } else {
      body = `<div class="badge invalid">❌ Liên kết không tồn tại, đã hết hạn hoặc đã được sử dụng.</div><p class="hint">Vui lòng kiểm tra lại email thông báo mới nhất từ hệ thống Belwee.</p>`;
    }

    return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleMap[state]} | Belwee Pet Clinic</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', -apple-system, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at top, #1e293b 0%, #020617 100%); color: #e2e8f0; padding: 20px; }
  .card { max-width: 460px; width: 100%; background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 36px 28px; box-shadow: 0 24px 60px rgba(0,0,0,0.5); text-align: center; }
  .icon { width: 64px; height: 64px; margin: 0 auto 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 28px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); }
  h1 { font-size: 20px; font-weight: 800; letter-spacing: 0.3px; color: #f1f5f9; margin-bottom: 6px; text-transform: uppercase; }
  .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 22px; }
  .info-card { background: rgba(2,6,23,0.5); border-radius: 14px; padding: 16px 18px; margin-bottom: 20px; text-align: left; border: 1px solid rgba(255,255,255,0.04); }
  .info-row { padding: 7px 0; font-size: 13px; border-bottom: 1px dashed rgba(255,255,255,0.05); display: flex; justify-content: space-between; gap: 12px; }
  .info-row:last-child { border-bottom: none; }
  .label { color: #64748b; }
  .value { color: #e2e8f0; font-weight: 600; text-align: right; }
  .value.id { color: #38bdf8; font-family: monospace; }
  .value.danger { color: #fb7185; }
  .btn-confirm { background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; padding: 14px 38px;
    border-radius: 12px; font-size: 14px; font-weight: 800; letter-spacing: 0.5px; cursor: pointer; box-shadow: 0 8px 24px rgba(16,185,129,0.35); transition: transform 0.2s; }
  .btn-confirm:hover { transform: translateY(-2px); }
  .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .hint { font-size: 12px; color: #64748b; margin: 18px 0; line-height: 1.5; }
  .status { margin-top: 16px; font-size: 13px; min-height: 20px; }
  .status.success { color: #34d399; }
  .status.error { color: #f87171; }
  .badge { padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; margin-bottom: 16px; }
  .badge.invalid { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
  .badge.success { background: rgba(16,185,129,0.1); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .logo { font-size: 13px; color: #475569; margin-top: 24px; letter-spacing: 1px; }
</style></head>
<body>
  <div class="card">
    <div class="icon">${iconMap[state]}</div>
    <h1>${titleMap[state]}</h1>
    <p class="subtitle">Belwee Pet Clinic — Hệ thống quản lý lịch hẹn</p>
    ${body}
    <div class="logo">BELWEE PET CLINIC</div>
  </div>
  <script>
    async function doConfirm() {
      const btn = document.getElementById('confirmBtn');
      const status = document.getElementById('status');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Đang xử lý...';
      status.className = 'status';
      try {
        const res = await fetch('/api/xac-nhan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: '${escapeHtml(token || '')}' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          status.className = 'status success';
          status.innerHTML = '✅ ' + (data.message || 'Xác nhận thành công! Email đã gửi cho khách hàng.');
          btn.style.display = 'none';
        } else {
          status.className = 'status error';
          status.innerHTML = '❌ ' + (data.message || 'Xác nhận thất bại.');
          btn.disabled = false;
          btn.innerHTML = '✅ Xác Nhận Đặt Lịch';
        }
      } catch (e) {
        status.className = 'status error';
        status.innerHTML = '❌ Lỗi kết nối mạng.';
        btn.disabled = false;
        btn.innerHTML = '✅ Xác Nhận Đặt Lịch';
      }
    }
  </script>
</body></html>`;
  };

  // Trường hợp 1: Thiếu token
  if (!token) {
    return new NextResponse(renderPage('invalid'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Tìm booking theo token
  const booking = await dbBooking.findByToken(token);

  if (!booking) {
    // Token không hợp lệ HOẶC đã bị xóa (single-use sau khi xác nhận)
    return new NextResponse(renderPage('invalid'), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Nếu booking đã CONFIRMED → hiển thị trang đã xác nhận
  if (booking.status === 'CONFIRMED') {
    return new NextResponse(renderPage('confirmed', booking), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Nếu booking đã CANCELLED → hiển thị trang đã huỷ
  if (booking.status === 'CANCELLED') {
    return new NextResponse(renderPage('cancelled'), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Hiển thị landing page trung gian với thông tin lịch hẹn (status = PENDING)
  return new NextResponse(renderPage('valid', booking), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// ──────────────────────────────────────────────────────────────
// POST: Admin bấm nút "Xác Nhận Đặt Lịch" từ landing page
// → Xác nhận token + Cập nhật trạng thái PENDING→CONFIRMED + Gửi email cho khách
// ──────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // Parsed outside the try below: a malformed body is a client error and must
  // not surface as "Lỗi server khi xử lý xác nhận." (500).
  const parsed = await readJsonBody<{ token?: unknown }>(request);
  if (!parsed.ok) {
    return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
  }

  // Narrowed to a string BEFORE it reaches the store: a JSON body may carry an
  // object/array here, and confirmByToken does string work (trim, map lookup).
  const rawToken = parsed.data?.token;
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';

  try {
    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Thiếu token xác nhận.' },
        { status: 400 }
      );
    }

    // 1. Xác nhận qua token (single-use + idempotent + TTL check)
    const result = await dbBooking.confirmByToken(token);

    if (!result.success || !result.booking) {
      return NextResponse.json(
        { success: false, message: result.error || 'Xác nhận thất bại.' },
        { status: 400 }
      );
    }

    const booking = result.booking;

    // 2. Gửi email "Đã Xác Nhận Đặt Lịch" tới khách hàng
    try {
      const customerMail = buildCustomerEmail(booking);
      const mailSent = await sendMail({
        to: booking.customerEmail,
        subject: customerMail.subject,
        html: customerMail.html,
      });

      if (!mailSent) {
        // DB đã cập nhật thành CONFIRMED nhưng email thất bại
        console.error('⚠️ DB đã cập nhật CONFIRMED nhưng gửi mail cho khách thất bại - Booking:', booking.id);
        return NextResponse.json({
          success: true,
          warning: 'Đã xác nhận đặt lịch nhưng gửi email cho khách thất bại.',
          bookingId: booking.id,
        });
      }
    } catch (mailErr) {
      console.error('⚠️ DB đã cập nhật CONFIRMED nhưng gửi mail cho khách thất bại:', mailErr);
      return NextResponse.json({
        success: true,
        warning: 'Đã xác nhận đặt lịch nhưng gửi email cho khách thất bại.',
        bookingId: booking.id,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Xác nhận thành công! Đã gửi email thông báo cho khách hàng.',
      bookingId: booking.id,
    });
  } catch (error) {
    console.error('❌ Lỗi API xac-nhan POST:', error);
    return NextResponse.json(
      { success: false, message: 'Lỗi server khi xử lý xác nhận.' },
      { status: 500 }
    );
  }
}
