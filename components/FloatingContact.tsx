"use client";

import Image from "next/image";
import React, { useState, useEffect, useRef } from "react";
import { HOTLINE, HOTLINE_ZALO } from "@/lib/clinics";

const CONTACT_ITEMS = [
  {
    id: "phone",
    label: "Gọi ngay",
    href: `tel:${HOTLINE}`,
    color: "#22c55e",
    glow: "rgba(34,197,94,0.45)",
    svgPath: "phone",
  },
  {
    id: "zalo",
    label: "Zalo",
    href: HOTLINE_ZALO,
    color: "#0068ff",
    glow: "rgba(0,104,255,0.45)",
    svgPath: "zalo",
  },
  {
    id: "booking",
    label: "Đặt lịch",
    href: "/booking/cham-soc-khach-hang",
    color: "#6366f1",
    glow: "rgba(99,102,241,0.45)",
    svgPath: "booking",
  },
  {
    id: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/BelweePetShop552LeDucTho/",
    color: "#1877f2",
    glow: "rgba(24,119,242,0.45)",
    svgPath: "facebook",
  },
];

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.7A2 2 0 012 .96h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.74a16 16 0 006.17 6.17l1.14-1.14a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

function ZaloIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" width={24} height={24}>
      <text x="4" y="48" fontSize="52" fontWeight="900" fontFamily="Arial, sans-serif">Z</text>
    </svg>
  );
}

function BookingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={22} height={22}>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

const ICONS: Record<string, React.ReactElement> = {
  phone: <PhoneIcon />,
  zalo: <ZaloIcon />,
  booking: <BookingIcon />,
  facebook: <FacebookIcon />,
};

export default function FloatingContact() {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const open = () => {
    setIsClosing(false);
    setIsOpen(true);
  };

  const close = () => {
    if (!isOpen) return;
    setIsClosing(true);
    setTimeout(() => {
      if (!mountedRef.current) return;
      setIsOpen(false);
      setIsClosing(false);
    }, 380);
  };

  const toggle = () => (isOpen ? close() : open());

  return (
    <>
      {isOpen && (
        <div
          className={`floating-contact-backdrop ${isClosing ? "is-closing" : "is-open"}`}
          onClick={close}
          aria-hidden="true"
        />
      )}

      <div className="floating-contact-root" role="complementary" aria-label="Liên hệ nhanh">
        {isOpen && (
          <div className={`floating-contact-items ${isClosing ? "is-closing" : "is-open"}`}>
            {CONTACT_ITEMS.map((item, idx) => (
              <a
                key={item.id}
                href={item.href}
                target={item.id === "phone" || item.id === "booking" ? undefined : "_blank"}
                rel={item.id === "phone" || item.id === "booking" ? undefined : "noopener noreferrer"}
                aria-label={item.label}
                className="floating-contact-btn"
                style={{
                  "--btn-color": item.color,
                  "--btn-glow": item.glow,
                  "--btn-idx": idx,
                } as React.CSSProperties}
                onClick={close}
              >
                <span className="floating-contact-tooltip">{item.label}</span>
                <span className="floating-contact-icon" style={{ color: item.color }}>
                  {ICONS[item.svgPath]}
                </span>
              </a>
            ))}
          </div>
        )}

        <button
          type="button"
          aria-label={isOpen ? "Đóng liên hệ" : "Mở liên hệ"}
          aria-expanded={isOpen}
          onClick={toggle}
          className={`floating-contact-main ${isOpen ? "is-open" : ""}`}
        >
          <Image
            src="/nutlienhe.png"
            alt="Liên hệ"
            width={62}
            height={62}
            className={`floating-contact-main-img ${isOpen ? "is-rotated" : ""}`}
            priority
          />
          {!isOpen && <span className="floating-contact-pulse" aria-hidden="true" />}
        </button>
      </div>
    </>
  );
}
