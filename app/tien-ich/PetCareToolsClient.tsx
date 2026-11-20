'use client';

// app/tien-ich/PetCareToolsClient.tsx
// Phần client của /tien-ich: hero + PetCareTools.
//
// Hero đặt ở đây (không phải server) vì tiêu đề và mô tả phải đổi theo ngôn
// ngữ — `translate()` của server chỉ có một ngôn ngữ tĩnh. Đánh đổi: crawler
// đọc metadata ở layout/page (đã khai bằng tiếng Việt) chứ không đọc được H1 hai
// ngôn ngữ. Đây là cách cả site đang làm (xem app/kien-thuc-thu-y).

import PetCareTools from '@/components/PetCareTools';
import Reveal from '@/components/Reveal';
import { useLanguage } from '@/components/LanguageProvider';

export default function PetCareToolsClient() {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-screen overflow-x-clip pb-24">
      {/* Quả cầu trang trí — cùng ngôn ngữ với các trang khác, chỉ đổi cường độ
          theo theme nhờ `.apple-mesh-bg`. */}
      <Reveal as="div" className="pointer-events-none absolute inset-0">
        <div className="apple-mesh-bg absolute -left-40 -top-24 size-[420px] rounded-full bg-[var(--pt-accent)] opacity-[0.14] blur-[120px]" />
      </Reveal>

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-28 sm:px-6 sm:pt-32 lg:px-8">
        <Reveal as="header" className="mb-10 text-center" delay={0.1}>
          <span className="inline-block rounded-full border border-[rgb(var(--pt-border-rgb)/0.18)] bg-[var(--pt-accent-soft)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.28em]">
            {t('tools.label')}
          </span>
          <h1 className="pt-heading mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('tools.title')}
          </h1>
          <p className="pt-muted mx-auto mt-3 max-w-2xl text-sm leading-6 sm:text-base">
            {t('tools.desc')}
          </p>
        </Reveal>

        <PetCareTools />

        {/* Nội dung tĩnh cho crawler. Các công cụ render phía client nên không
            có HTML tĩnh; đoạn này đảm bảo trang vẫn mô tả đúng nội dung. */}
        <div className="sr-only" aria-hidden="true">
          <h2>{t('tools.ageTitle')}</h2>
          <p>{t('tools.ageDesc')}</p>
          <h2>{t('tools.foodTitle')}</h2>
          <p>{t('tools.foodDesc')}</p>
          <h2>{t('tools.checkTitle')}</h2>
          <p>{t('tools.checkDesc')}</p>
          <p>{t('tools.disclaimer')}</p>
        </div>
      </div>
    </div>
  );
}