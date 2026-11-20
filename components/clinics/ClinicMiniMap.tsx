"use client";

/**
 * components/clinics/ClinicMiniMap.tsx
 *
 * Bản đồ tương tác nền đường phố THẬT — Leaflet + OpenStreetMap.
 *
 * ── LỊCH SỬ: VÌ SAO BẢN NÀY THAY CÁCH LÀM ─────────────────────────────────
 * Bản trước tự vẽ bằng SVG: đúng toạ độ, đúng hướng bắc, đúng tỉ lệ khoảng
 * cách, có thanh tỉ lệ — nhưng KHÔNG có đường, sông, tên đường. Đó là lưới
 * toạ độ, không phải bản đồ.
 *
 * Lý do chọn SVG thời đó có thật và không nên phủ nhận: nhúng Google Maps cần
 * API key, OSM tiles cũng là yêu cầu ra bên thứ ba — cả hai đều làm rỗng cam
 * kết mà trang Liên hệ đang hiển thị cho khách ("không gửi vị trí của bạn đi
 * đâu cả").
 *
 * Nay chủ dự án quyết định ưu tiên bản đồ thật (master prompt 5.3, hạng P0).
 * Vì vậy cam kết quyền riêng tư được SỬA cho đúng thực tế, thay vì giữ một
 * lời hứa không còn đúng.
 *
 * ── VÌ SAO DÙNG LEAFLET imperative, KHÔNG DÙNG react-leaflet ────────────────
 * `react-leaflet` đòi render ở client-only, tức phải `next/dynamic({ssr:false})`
 * ở một file khác, cộng thêm một lớp trừu tượng cho đúng một bản đồ. Gọi trực
 * tiếp `L.map(...)` trong `useEffect` cho quyền kiểm soát trực tiếp những thứ
 * hay vỡ ở đây: `invalidateSize()` khi layout đổi, hủy map khi component unmount,
 * và khoá khởi tạo để React Strict Mode không tạo map hai lần.
 *
 * ── NHỮNG GÌ GIỮ NGUYÊN ─────────────────────────────────────────────────────
 *   • Toạ độ lấy từ `lib/clinics.ts` — nguồn duy nhất, không nhân bản.
 *   • Vị trí người dùng KHÔNG được gửi đi đâu: chỉ dùng để vẽ marker và tính
 *     khoảng cách Haversine ngay trong trình duyệt.
 *   • Vẫn có nút "Mở trên Google Maps".
 *   • Không dùng API key nào.
 *
 * ── VỀ OSM TILES ────────────────────────────────────────────────────────────
 * `tile.openstreetmap.org` là hạ tầng dùng chung, chấp nhận lưu lượng THẤP.
 * Đây là một bản đồ nhỏ trong trang Liên hệ. Nếu sau này nhúng bản đồ ở nhiều
 * trang hoặc lưu lượng tăng, phải chuyển sang nhà cung cấp tile thương mại
 * hoặc tự phục vụ tile. Attribution bắt buộc có trong JSX.
 */

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { BRANCHES, mapsDirectionsUrl } from "@/lib/clinics";
import { useLanguage } from "@/components/LanguageProvider";

interface Props {
  /** Chi nhánh cần làm nổi bật (thường là chi nhánh vừa tìm ra). */
  focusId?: string | null;
  /** Vị trí người dùng — chỉ để vẽ, KHÔNG gửi đi đâu. */
  user?: { lat: number; lng: number } | null;
  /** Bấm vào một chi nhánh trên bản đồ. */
  onPick?: (branchId: string) => void;
}

const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Trung tâm TP.HCM — chỉ làm góc nhìn ban đầu trước khi fitBounds. */
const FALLBACK_CENTER: [number, number] = [10.8231, 106.6297];

/** Bản đồ phải có kích thước thật trước khi khởi tạo, nếu không Leaflet tính
 *  kích thước = 0 và hiển thị một mảng trống. Chiều cao này là khung dự phòng. */
const MAP_HEIGHT_CLASS = "h-[300px] sm:h-[360px] md:h-[420px]";

const PRIVACY_NOTE = {
  vi: "Vị trí của bạn chỉ dùng trong trình duyệt và không được lưu. Ảnh bản đồ tải từ OpenStreetMap nên nhà cung cấp đó có thể thấy địa chỉ IP của bạn.",
  en: "Your location is used only in your browser and is never stored. Map tiles come from OpenStreetMap, so that provider may see your IP address.",
} as const;

export default function ClinicMiniMap({ focusId, user, onPick }: Props) {
  const { lang } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Record<string, LeafletMarker>>({});
  const userMarkerRef = useRef<LeafletMarker | null>(null);
  const slowTimerRef = useRef<number | null>(null);
  // Giữ callback mới nhất mà không phải khởi tạo lại bản đồ mỗi lần render.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const [loaded, setLoaded] = useState(false);
  const [tileFailed, setTileFailed] = useState(false);

  const located = BRANCHES.filter((b) => b.coords != null);
  const locatedKey = located.map((b) => b.id).join(",");

  // ── Khởi tạo map (đúng MỘT lần) ────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    let disposed = false;
    let map: LeafletMap | null = null;
    let loadedTiles = 0;

    (async () => {
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;
      await import("leaflet/dist/leaflet.css");
      if (disposed || !containerRef.current) return;

      const bounds = L.latLngBounds(located.map((b) => [b.coords!.lat, b.coords!.lng]));
      map = L.map(el, {
        center: bounds.isValid() ? bounds.getCenter() : FALLBACK_CENTER,
        zoom: 13,
        scrollWheelZoom: false, // không cướp cuộn trang trên desktop
        attributionControl: true,
      });

      const tiles = L.tileLayer(OSM_URL, {
        attribution: OSM_ATTR,
        maxZoom: 19,
        crossOrigin: true,
      });
      tiles.on("tileerror", () => setTileFailed(true));
      tiles.on("load", () => setTileFailed(false));
      tiles.addTo(map);

      // `tileerror` KHÔNG đủ tin cậy: khi máy offline, trình duyệt hủy yêu cầu
      // và Leaflet đôi khi không bắn sự kiện này — bản đồ chỉ hiện một khung
      // xám trắng mà không có dấu hiệu "đã hỏng". Nên thêm một canh gácc theo
      // thời gian: nếu sau 8 giây vẫn chưa tải được ô nào thì coi như hỏng và
      // hiện hướng dẫn dự phòng.
      const slowTimer = window.setTimeout(() => {
        if (loadedTiles === 0) setTileFailed(true);
      }, 8000);
      slowTimerRef.current = slowTimer;
      const bumpLoaded = () => {
        loadedTiles += 1;
        setTileFailed(false);
      };
      tiles.on("tileload", bumpLoaded);

      L.control.zoom({ position: "topright" }).addTo(map);

      for (const b of located) {
        const isFocus = focusId === b.id;
        const marker = L.marker([b.coords!.lat, b.coords!.lng], {
          title: `${b.code} — ${b.addressShort}`,
          alt: b.addressShort,
          icon: L.divIcon({
            className: "",
            html: `<span style="
              display:inline-block;width:${isFocus ? 22 : 16}px;height:${isFocus ? 22 : 16}px;
              border-radius:9999px;background:${isFocus ? "#2563eb" : "#ffffff"};
              border:3px solid #2563eb;box-shadow:0 2px 6px rgba(15,23,42,.35);
            "></span>`,
            iconSize: [isFocus ? 22 : 16, isFocus ? 22 : 16],
            iconAnchor: [isFocus ? 11 : 8, isFocus ? 11 : 8],
          }),
        });
        marker.bindPopup(
          `<strong>${b.code}</strong><br/>${b.addressShort}<br/>
           <a href="${mapsDirectionsUrl(b.address)}" target="_blank" rel="noopener noreferrer">Chỉ đường</a>`,
        );
        marker.on("click", () => onPickRef.current?.(b.id));
        marker.addTo(map);
        markersRef.current[b.id] = marker;
      }

      mapRef.current = map;

      // Khung có thể vừa được layout lại sau khi gắn (ví dụ sidebar co lại).
      setTimeout(() => map?.invalidateSize(), 0);

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36] });
      setLoaded(true);
    })();

    return () => {
      disposed = true;
      if (slowTimerRef.current !== null) {
        window.clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
      // `map.remove()` giải phóng listener + pane; bỏ qua chỉ là rò rỉ DOM.
      map?.remove();
      mapRef.current = null;
      markersRef.current = {};
      userMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locatedKey]);

  // ── Đồng bộ chi nhánh đang được chọn ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusId) return;
    const marker = markersRef.current[focusId];
    const branch = BRANCHES.find((b) => b.id === focusId);
    if (!marker || !branch?.coords) return;

    map.flyTo([branch.coords.lat, branch.coords.lng], 16, { duration: 0.6 });
    marker.openPopup();
  }, [focusId, loaded]);

  // ── Marker vị trí người dùng ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = mapRef.current;
      if (!map) return;
      const L = await import("leaflet");
      if (cancelled || !user) return;

      userMarkerRef.current?.remove();
      userMarkerRef.current = L.marker([user.lat, user.lng], {
        title: "Vị trí của bạn",
        icon: L.divIcon({
          className: "",
          html: `<span style="
            display:inline-block;width:18px;height:18px;border-radius:9999px;
            background:#ef4444;border:3px solid #ffffff;
            box-shadow:0 0 0 2px rgba(239,68,68,.35),0 2px 6px rgba(15,23,42,.35);
          "></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      })
        .addTo(map)
        .bindPopup("Vị trí của bạn");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loaded]);

  // ── Cửa sổ đổi kích thước ───────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [loaded]);

  return (
    <div className="w-full">
      <div className={`relative w-full ${MAP_HEIGHT_CLASS}`}>
        <div
          ref={containerRef}
          className="h-full w-full rounded-3xl border border-slate-200"
          aria-label="Bản đồ các chi nhánh Belwee"
          role="application"
        />

        {!loaded && (
          <div className="absolute inset-0 animate-pulse rounded-3xl bg-slate-100" aria-hidden="true" />
        )}

        {tileFailed && (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/95 p-3 text-center shadow-lg">
            <p className="text-xs font-semibold text-slate-700">
              {lang === "vi" ? "Không tải được ảnh bản đồ." : "Map tiles could not be loaded."}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {lang === "vi"
                ? "Địa chỉ và nút chỉ đường bên dưới vẫn dùng được."
                : "Addresses and the directions link below still work."}
            </p>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {PRIVACY_NOTE[lang === "en" ? "en" : "vi"]}
      </p>

      <p className="mt-2 text-[10px] text-slate-400">
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}