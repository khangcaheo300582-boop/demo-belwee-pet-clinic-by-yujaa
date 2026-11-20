"use client";

/**
 * components/clinics/NearestBranchFinder.tsx
 *
 * Hạng mục 25.4 — "Tìm chi nhánh gần tôi".
 *
 * ── DÙNG `nearestBranch()` CÓ SẴN, KHÔNG TỰ TÍNH LẠI ──────────────────────────
 * `lib/clinics.ts` đã có `distanceKm()` (Haversine) và `nearestBranch()`, cùng
 * kiểu `coords: … | null` và quy tắc trả `null` khi thiếu dữ liệu. Component này
 * chỉ lo phần UI. Không viết lại phép tính khoảng cách ở đây — hai bản sẽ lệch
 * nhau theo thời gian và rất khó phát hiện.
 *
 * ── KHÔNG TỰ HỎI QUYỀN ĐỊNH VỊ KHI VÀO TRANG ─────────────────────────────────
 * Đây là quyết định sản phẩm, không phải kỹ thuật: trình duyệt hiện cảnh báo
 * "trang này muốn biết vị trí của bạn" NGAY khi mở, trước khi người dùng đọc
 * được dòng tiêu đề. Người dùng từ chối thì không có cách nào "lấy lại" lần
 * nữa trong phiên đó. Vì vậy chỉ hỏi khi họ BẤM nút.
 *
 * ── KHÔNG GỬI TOẠ ĐỘ ĐI ĐÂU ĐẤC ──────────────────────────────────────────────
 * `getCurrentPosition` cho toạ độ trong bộ nhớ của trình duyệt. Component này
 * chỉ dùng nó để so sánh với 4 toạ độ chi nhánh rồi hiện kết quả. Không gửi
 * `fetch`, không lưu `localStorage`, không ghi log. Đây là dữ liệu nhạy cảm; giữ
 * nó ở máy người dùng là mặc định an toàn.
 *
 * ── KHÔNG CHẠY NGẦM KHI SERVER RENDER ────────────────────────────────────────
 * `navigator.geolocation` chỉ có ở client. Kiểm tra `typeof navigator` trước khi
 * gọi, và mọi trạng thái ban đầu đều là "hỏi" chứ không phải kết quả — nên
 * server và client render ra giống nhau, không có hydration mismatch.
 */

import { useState } from "react";
import { BRANCHES, nearestBranch } from "@/lib/clinics";
import { useLanguage } from "@/components/LanguageProvider";
import type { MessageKey } from "@/lib/i18n";
import { CheckIcon, LocateIcon } from "@/components/ui/icons";
import ClinicMiniMap from "@/components/clinics/ClinicMiniMap";

/**
 * Trạng thái của tiện ích tìm chi nhánh.
 *
 * `far` là trạng thái riêng, không gộp vào `error`: người dùng ở ngoài TP.HCM
 * VẪN có câu trả lời hợp lệ ("chi nhánh gần bạn nhất là…"), chỉ là con số đó
 * không có ý nghĩa với họ. Nói thẳng ra còn hơn đưa ra một con số như thật.
 */
type Status =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "found"; branchId: string; km: number; user: { lat: number; lng: number } }
  | { kind: "far"; branchId: string; km: number; user: { lat: number; lng: number } }
  | { kind: "denied" }
  | { kind: "unsupported" }
  | { kind: "timeout" }
  | { kind: "failed" };

/**
 * Trên bao nhiêu km thì bắt đầu coi là "ngoài vùng phục vụ".
 *
 * 4 chi nhánh nằm trong bán kính ~8km quanh trung tâm TP.HCM. Người ở Hà Nội
 * (~1400km) vẫn được hàm Haversine trả về "chi nhánh gần nhất" một cách đúng
 * về mặt toán học và hoàn toàn vô nghĩa về mặt thực tế. 30km là ngưỡng rõ ràng:
 * bên trong thì con số có ích, bên ngoài thì báo thẳng.
 */
const NEAR_LIMIT_KM = 30;

export default function NearestBranchFinder({
  onFound,
}: {
  /** Báo về id chi nhánh để ClinicSystem tô đậm thẻ tương ứng. */
  onFound?: (branchId: string) => void;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const locate = () => {
    // Không có API, hoặc đang chạy ngoài ngữ cảnh an toàn (iframe `sandbox`) —
    // cả hai đều không hỏi được. Báo riêng để người dùng biết vì sao.
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus({ kind: "unsupported" });
      return;
    }

    setStatus({ kind: "locating" });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const hit = nearestBranch({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        // `nearestBranch` trả null khi không chi nhánh nào có toạ độ. Không tự
        // chế ra một chi nhánh trong trường hợp đó.
        if (!hit) {
          setStatus({ kind: "failed" });
          return;
        }
        // Giữ toạ độ để vẽ điểm "bạn ở đây" trên bản đồ. Chỉ nằm trong bộ nhớ
        // của trình duyệt — không `fetch`, không `localStorage`, không log.
        const user = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setStatus(
          hit.km <= NEAR_LIMIT_KM
            ? { kind: "found", branchId: hit.branch.id, km: hit.km, user }
            : { kind: "far", branchId: hit.branch.id, km: hit.km, user }
        );
        onFound?.(hit.branch.id);
      },
      (err) => {
        // Mã lỗi 1 = PERMISSION_DENIED, 3 = TIMEOUT. Phân biệt để câu chữ
        // hữu ích: "bạn đã từ chối" khác hẳn "lâu quá không xong".
        if (err.code === 1) setStatus({ kind: "denied" });
        else if (err.code === 3) setStatus({ kind: "timeout" });
        else setStatus({ kind: "failed" });
      },
      {
        // Không cần độ chính xác cao: so sánh giữa các toạ độ cách nhau vài km.
        // Bật `enableHighAccuracy` chỉ làm tốn pin mà không cải thiện kết quả.
        enableHighAccuracy: false,
        // Chờ tối đa 10s rồi bỏ — treo vô hạn là tệ nhất với người dùng.
        timeout: 10000,
        // Cache vị trí 5 phút: bấm lần hai trong 5 phút không cần hỏi lại.
        maximumAge: 300000,
      }
    );
  };

  const busy = status.kind === "locating";

  /** Tên chi nhánh tương ứng với id tìm được — lấy từ BRANCHES, không gõ tay. */
  const nameOf = (id: string): MessageKey => {
    const b = BRANCHES.find((x) => x.id === id);
    return b ? b.fullNameKey : ("branches.b1Name" as MessageKey);
  };

  // Khoảng cách là đường THẲNG, không phải đường lái xe. Nói rõ, vì người đọc
  // dễ hiểu "3,2 km" là 3,2 km đi xe.
  const kmText = (km: number) => `${km.toFixed(1).replace(".", ",")} km`;

  const hasResult = status.kind === "found" || status.kind === "far";
  const focusBranch = hasResult ? status.branchId : null;
  const mapUser = hasResult ? status.user : null;
  const foundBranch = focusBranch ? BRANCHES.find((b) => b.id === focusBranch) : undefined;

  return (
    // GĐ9 · (d): TÁCH khỏi cụm thẻ chi nhánh.
    // Trước GĐ9 block này nằm ngay dưới lưới thẻ với `mt-10` và cùng kiểu
    // bo góc ⇒ đọc như một thẻ thứ N của lưới. Nay có lề trên riêng, đường kẻ
    // ngăn và nền khác để thấy rõ đây là công cụ, không phải chi nhánh.
    <section
      aria-label={t("nearest.title")}
      className="mt-14 rounded-[28px] border border-slate-200 bg-slate-50/80 p-6 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.5)] sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{t("nearest.title")}</p>
          <p className="mt-1 text-[13px] leading-6 text-slate-600">{t("nearest.hint")}</p>
        </div>

        {/*
          GĐ9 · (d): nút đi qua BA trạng thái hình dạng khác nhau, theo yêu cầu:
            1. `idle`    → viên thuốc (pill) xanh, chữ "Dùng vị trí của tôi"
            2. `locating`→ vẫn viên thuốc nhưng chạy dấu quét tròn + chữ "Đang tìm…"
            3. kết quả   → THU NHỎ thành hình tròn xanh lá, icon tâm vị trí đổi
                           thành tích, có hiệu ứng pop
          Nhánh lỗi (`denied`/`timeout`/`failed`/`unsupported`) trả về viên thuốc
          xanh như cũ — nút vẫn bấm lại được, đúng như trước.

          Vì sao dùng `animate` cho `transform`/`box-shadow` chứ không phải
          `width`: đổi `width` sẽ reflow mỗi khung hình và làm nút giật. Ổ nút
          có kích thước cố định nên chỉ cần transform + opacity.
        */}
        <button
          type="button"
          onClick={locate}
          disabled={busy}
          aria-label={busy ? t("nearest.locating") : hasResult ? t("nearest.done") : t("nearest.button")}
          /* `data-shape` thay cho `:has()` trong CSS — xem khối giải thích ở
             globals.css. `:has()` chỉ có từ 2022–2023, còn nút là trạng thái
             hình dạng chính nên không được phụ thuộc selector mới. */
          data-shape={hasResult ? "circle" : "pill"}
          className={`nb-locate-btn shrink-0 ${hasResult ? "nb-locate-btn--done" : ""}`}
        >
          <span className="nb-locate-btn__inner">
            {hasResult ? (
              // Trạng thái xong: chỉ còn dấu tích trong hình tròn.
              <CheckIcon className="nb-locate-btn__icon" />
            ) : busy ? (
              <span aria-hidden="true" className="nb-locate-spinner" />
            ) : (
              <LocateIcon className="nb-locate-btn__icon" />
            )}
            <span className={`nb-locate-btn__label ${hasResult ? "sr-only" : ""}`}>
              {busy ? t("nearest.locating") : t("nearest.button")}
            </span>
          </span>
        </button>
      </div>

      {/*
        `aria-live="polite"` để trình đọc màn hình đọc kết quả khi nó xuất hiện.
        Vùng luôn có trong DOM (chỉ đổi nội dung) — đặt `aria-live` trên phần tử
        vốn đã tồn tại thì trình đọc mới báo, đặt kèm lúc sinh ra thì thường bị bỏ.
      */}
      <p
        aria-live="polite"
        className={`mt-5 text-sm ${status.kind === "far" ? "text-amber-700" : "text-slate-700"}`}
      >
        {status.kind === "found" && (
          <>
            <strong className="font-semibold">{t(nameOf(status.branchId))}</strong>{" "}
            — {t("nearest.found", { km: kmText(status.km) })}
          </>
        )}
        {status.kind === "far" && (
          <>
            {t("nearest.far", { km: kmText(status.km) })}{" "}
            <span className="text-slate-600">{t(nameOf(status.branchId))}</span>
          </>
        )}
        {status.kind === "denied" && t("nearest.denied")}
        {status.kind === "unsupported" && t("nearest.unsupported")}
        {status.kind === "timeout" && t("nearest.timeout")}
        {status.kind === "failed" && t("nearest.failed")}
      </p>

      {hasResult && <p className="mt-2 text-[12px] text-slate-500">{t("nearest.straightLine")}</p>}

      {/* GĐ9 · (d): bản đồ Leaflet thật — xem khối giải thích trong
          ClinicMiniMap.

          KHÔNG bọc trong `hasResult`: trước đây bản đồ chỉ hiện SAU KHI khách
          cấp quyền vị trí, tức mặc định trang Liên hệ không có bản đồ. Điều đó
          sai với yêu cầu "danh sách chi nhánh luôn đầy đủ để dùng không cần
          thao tác map" và làm trang phụ thuộc vào một hộp thoại quyền riêng tư.

          Nay bản đồ luôn hiện với đủ 4 marker chi nhánh; marker vị trí người
          dùng chỉ xuất hiện sau khi họ bấm "Dùng vị trí của tôi". */}
      <ClinicMiniMap focusId={focusBranch} user={mapUser} />
      {foundBranch?.mapUrl && (
        <a
          href={foundBranch.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:decoration-blue-600"
        >
          {t("nearest.openInMaps")} →
        </a>
      )}
    </section>
  );
}