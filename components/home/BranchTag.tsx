"use client";

import { Siren } from "lucide-react";
import clsx from "clsx";

/**
 * Tag dạng pill.
 * `kind`:
 *  - `"service"` — tag dịch vụ / giờ mở cửa, nền xanh nhạt, viền + chữ xanh.
 *  - `"emergency"` — nền đỏ cam `#FF5A4F`, chữ trắng, kèm icon còi báo động bên
 *    trái, có gói pulse nhẹ (tắt khi `prefers-reduced-motion`).
 */
export default function BranchTag({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: "service" | "emergency";
}) {
  const isEmergency = kind === "emergency";

  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-full px-6 py-2.5 text-[13px] font-medium leading-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F5BD9]",
        isEmergency
          ? "bg-[#FF5A4F] text-white"
          : "bg-[#E8EEFF] border border-[#1F5BD9]/35 text-[#1F5BD9]",
      )}
    >
      {isEmergency && (
        <span className="bt-siren flex h-3.5 w-3.5 shrink-0" aria-hidden="true">
          <Siren className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
      {children}
    </span>
  );
}

export const pulseCSS = `
  .bt-siren { animation: bt-siren-pulse 1.8s ease-in-out infinite; }
  @keyframes bt-siren-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(1.12); opacity: 0.7; }
  }
  @media (prefers-reduced-motion: reduce) {
    .bt-siren { animation: none !important; }
  }
`;