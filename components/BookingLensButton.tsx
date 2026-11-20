"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface BookingLensButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
}

/**
 * Nút CTA kiểu "liquid glass lens" với hiệu ứng ánh sáng tĩnh, không theo dõi chuột.
 */
export default function BookingLensButton({
  icon,
  children,
  ...rest
}: BookingLensButtonProps) {
  return (
    <button
      type="button"
      className="booking-lens-button"
      {...rest}
    >
      <span className="booking-lens-button__blur" aria-hidden="true" />
      <span className="booking-lens-button__reflection" aria-hidden="true" />
      {/* Dải sáng tự quét; không có hiệu ứng bám theo con trỏ. */}
      <span className="booking-lens-button__sweep" aria-hidden="true" />
      <span className="booking-lens-button__content">
        {icon && (
          <span className="booking-lens-button__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="booking-lens-button__text">{children}</span>
      </span>
    </button>
  );
}