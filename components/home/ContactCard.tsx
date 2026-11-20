"use client";

import { Phone } from "lucide-react";
import clsx from "clsx";
import { telUrl } from "@/data/branches";

/**
 * Icon Zalo — vuông bo xanh có chữ "Zalo".
 */
function ZaloIcon() {
  return (
    <span
      className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#1F5BD9] text-white text-[11px] font-bold tracking-[-.02em]"
      aria-hidden="true"
    >
      Zalo
    </span>
  );
}

const hoverTransition = "transition-transform .25s ease-out, box-shadow .25s ease-out";

/**
 * Card liên hệ dạng chip.
 * `kind`:
 *  - `"zalo"`  → `https://zalo.me/<số>` (mở tab mới, rel noopener).
 *  - `"phone"` → `tel:<số>`.
 */
export default function ContactCard({
  kind,
  number,
  ariaLabel,
}: {
  kind: "zalo" | "phone";
  number: string;
  ariaLabel?: string;
}) {
  const digits = number.replace(/\D/g, "");
  const href = kind === "zalo" ? `https://zalo.me/${digits}` : telUrl(number);
  const rel = kind === "zalo" ? "noopener noreferrer" : undefined;
  const target = kind === "zalo" ? "_blank" : undefined;

  const icon =
    kind === "zalo" ? (
      <ZaloIcon />
    ) : (
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#1F5BD9] text-white" aria-hidden="true">
        <Phone className="h-5 w-5" aria-hidden="true" />
      </span>
    );

  return (
    <a
      href={href}
      {...(target ? { target, rel } : {})}
      className={clsx(
        "flex h-full min-w-[140px] w-full flex-col items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4 text-center shadow-[0_2px_8px_-3px_rgba(0,0,0,.06)]",
        hoverTransition,
        "hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-14px_rgba(0,0,0,.32)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#1F5BD9]",
      )}
      aria-label={ariaLabel}
    >
      {icon}
      <span className="text-[#0F1B3D] font-semibold text-[15px] leading-snug sm:text-[16px]">
        {number}
      </span>
    </a>
  );
}