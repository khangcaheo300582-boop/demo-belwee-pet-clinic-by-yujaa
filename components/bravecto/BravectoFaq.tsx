"use client";

/**
 * components/bravecto/BravectoFaq.tsx
 *
 * Accordion FAQ của trang Bravecto 365.
 *
 * ── VÌ SAO `grid-template-rows: 0fr → 1fr` ──────────────────────────────────
 * Cách cũ là `max-height` với một con số đoán trước: nội dung dài hơn con số đó
 * bị CẮT, ngắn hơn thì animation dừng giữa chừng rồi mới nhảy. `grid-template-rows`
 * cho chiều cao THẬT của nội dung mà vẫn animate được mượt (transition trên
 * track `fr`), không cần JS đo `scrollHeight`, không cần đặt lại chiều cao sau
 * khi mở. Trình duyệt cũ không animate track thì panel vẫn mở/đóng tức thì —
 * mất hiệu ứng, không mất chức năng.
 *
 * Mỗi mục dùng `<h3><button aria-expanded aria-controls>` — chuẩn ARIA accordion,
 * điều khiển được bằng Tab/Enter/Space mà không cần bắt keydown tay.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import styles from "./Bravecto365Page.module.css";

interface FaqEntry {
  question: string;
  answer: string;
}

/** Nội dung lấy đúng theo bản thiết kế — không thêm thông tin y khoa mới. */
const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    question: "Bravecto 365 là chương trình gì?",
    answer:
      "Đây là chương trình giới thiệu giải pháp Bravecto 365 tại Belwee. Nội dung sử dụng và chỉ định cụ thể cần được bác sĩ thú y tư vấn dựa trên tình trạng của từng bé.",
  },
  {
    question: "Bé nào có thể sử dụng sản phẩm?",
    answer:
      "Việc sử dụng cần dựa trên độ tuổi, cân nặng, tình trạng sức khỏe và tiền sử của từng bé. Bác sĩ thú y tại Belwee sẽ thăm khám và tư vấn để xác định sản phẩm có phù hợp hay không.",
  },
  {
    question: "Tôi cần chuẩn bị gì trước khi đến phòng khám?",
    answer:
      "Bạn nên mang theo sổ tiêm chủng hoặc lịch sử khám (nếu có) và ghi chú về ăn uống, sinh hoạt cùng các sản phẩm phòng ký sinh trùng bé đã dùng gần đây để bác sĩ tư vấn chính xác hơn.",
  },
  {
    question: "Làm thế nào để đặt lịch tư vấn?",
    answer:
      "Bạn có thể bấm “Đặt lịch hẹn” trên thanh điều hướng hoặc “Đăng ký tư vấn” trong trang này, hoặc liên hệ trực tiếp hotline/Zalo của Belwee để được đội ngũ hỗ trợ.",
  },
];

export default function BravectoFaq() {
  // Mặc định mở mục 1; mỗi lần CHỈ một mục mở (bấm lại mục đang mở thì đóng).
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={styles.faqList} data-reveal="fade-up">
      {FAQ_ENTRIES.map((entry, index) => {
        const isOpen = openIndex === index;
        const panelId = `bravecto-faq-panel-${index}`;
        const buttonId = `bravecto-faq-button-${index}`;

        return (
          <div
            key={entry.question}
            className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ""}`}
          >
            <h3 className={styles.faqHeading}>
              <button
                type="button"
                id={buttonId}
                className={styles.faqButton}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span>{entry.question}</span>
                <span className={styles.faqSign} aria-hidden="true">
                  <Plus size={16} strokeWidth={2.6} />
                </span>
              </button>
            </h3>

            <div className={styles.faqPanel} id={panelId} role="region" aria-labelledby={buttonId}>
              <div className={styles.faqPanelInner}>
                <p className={styles.faqAnswer}>{entry.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
