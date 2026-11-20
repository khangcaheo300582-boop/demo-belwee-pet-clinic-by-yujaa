'use client';

/**
 * components/KnowledgeArticleBody.tsx
 * Renders a KnowledgeBlock[] as JSX.
 *
 * WHY THIS EXISTS INSTEAD OF `dangerouslySetInnerHTML`
 *   The previous implementation rendered `detailContent` with
 *   `dangerouslySetInnerHTML`. Today the string is hand-written in
 *   lib/knowledgeData.ts so it is not live XSS — but it is one CMS migration away
 *   from being one, and `dangerouslySetInnerHTML` is the exact construct an
 *   audit flags. Structured blocks render through the normal React path: text is
 *   escaped by construction, and a malformed block cannot inject markup.
 *
 *   It also fixes a reading problem: a single `<p>` per newline gives no headings,
 *   no lists and no callouts, so every article was one undifferentiated wall of
 *   15px text.
 *
 * ANCHORS
 *   Headings carry a stable `id` from knowledgeToc() so the table of contents can
 *   deep-link into a section, and so a shared link to a section survives a title
 *   edit (the id is derived from the text, which is the trade-off we accept —
 *   the alternative, hand-written ids, would need maintaining in two places).
 */

import Image from 'next/image';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CalendarCheck, Info, PawPrint, Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import {
  knowledgeArticles,
  knowledgeToc,
  slugifyHeading,
  type KnowledgeArticle,
  type KnowledgeBlock,
} from '@/lib/knowledgeData';
import { cn } from '@/lib/utils';

/** Màu + icon cho từng mức callout. */
const CALLOUT = {
  info: {
    Icon: Info,
    shell: 'border-sky-400/25 bg-sky-400/10',
    accent: 'text-sky-300',
    title: 'text-sky-100',
  },
  warning: {
    Icon: AlertTriangle,
    shell: 'border-amber-400/30 bg-amber-400/10',
    accent: 'text-amber-300',
    title: 'text-amber-100',
  },
  success: {
    Icon: Sparkles,
    shell: 'border-emerald-400/25 bg-emerald-400/10',
    accent: 'text-emerald-300',
    title: 'text-emerald-100',
  },
} as const;

interface Props {
  article: KnowledgeArticle;
  /** Làm nổi các mục chứa kết quả tìm kiếm (dùng ở trang đọc bài). */
  highlight?: string;
}

export default function KnowledgeArticleBody({ article, highlight = '' }: Props) {
  const { t } = useLanguage();
  const toc = knowledgeToc(article);

  /**
   * Tách `text` quanh `highlight` thành các mảng text thuần.
   * React escape sẵn nên không cần dangerouslySetInnerHTML — đây là cách
   * highlight an toàn bằng JSX thay vì sinh thẻ <mark> từ chuỗi.
   */
  function segments(text: string): Array<{ text: string; hit: boolean }> {
    const needle = highlight.trim().toLowerCase();
    if (!needle) return [{ text, hit: false }];
    const out: Array<{ text: string; hit: boolean }> = [];
    const lower = text.toLowerCase();
    let from = 0;
    for (;;) {
      const at = lower.indexOf(needle, from);
      if (at === -1) break;
      if (at > from) out.push({ text: text.slice(from, at), hit: false });
      out.push({ text: text.slice(at, at + needle.length), hit: true });
      from = at + needle.length;
    }
    if (from < text.length) out.push({ text: text.slice(from), hit: false });
    return out.length > 0 ? out : [{ text, hit: false }];
  }

  function renderText(text: string) {
    return segments(text).map((seg, index) =>
      seg.hit ? (
        <mark key={index} className="rounded bg-amber-300/25 px-0.5 text-amber-100">
          {seg.text}
        </mark>
      ) : (
        <span key={index}>{seg.text}</span>
      )
    );
  }

  function renderBlock(block: KnowledgeBlock, key: number) {
    switch (block.kind) {
      case 'paragraph':
        return (
          <p key={key} className="text-[15px] leading-[1.85] text-slate-200">
            {renderText(block.text)}
          </p>
        );

      case 'heading': {
        // Khớp với thứ tự trong knowledgeToc(): chỉ đếm các heading.
        const order = article.sections
          .slice(0, key)
          .filter((b) => b.kind === 'heading').length;
        const id = `sec-${order}-${slugifyHeading(block.text)}`;
        return (
          <h2
            key={key}
            id={id}
            className="mt-9 scroll-mt-28 text-xl font-bold tracking-tight text-white sm:text-2xl"
          >
            <span
              aria-hidden="true"
              className="mr-2.5 inline-block h-4 w-1 translate-y-0.5 rounded-full bg-gradient-to-b from-sky-400 to-emerald-400"
            />
            {renderText(block.text)}
          </h2>
        );
      }

      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul';
        return (
          <Tag key={key} className="space-y-2.5 pl-1">
            {block.items.map((item, index) => (
              <li key={index} className="flex gap-3 text-[15px] leading-[1.8] text-slate-200">
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 flex shrink-0 items-center justify-center text-xs font-bold',
                    block.ordered
                      ? 'size-6 rounded-full bg-sky-500/18 text-sky-300 ring-1 ring-sky-400/25'
                      : 'size-6 text-sky-300'
                  )}
                >
                  {block.ordered ? index + 1 : '•'}
                </span>
                <span>{renderText(item)}</span>
              </li>
            ))}
          </Tag>
        );
      }

      case 'iconGrid':
        return (
          <div
            key={key}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
          >
            {block.items.map((item, index) => (
              <div
                key={index}
                role="listitem"
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-sky-400/25 hover:bg-white/[0.07]"
              >
                <span
                  aria-hidden="true"
                  className="mb-2.5 flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 text-lg"
                >
                  {item.icon}
                </span>
                <p className="text-sm font-bold text-white">{renderText(item.label)}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                  {renderText(item.detail)}
                </p>
              </div>
            ))}
          </div>
        );

      case 'callout': {
        const tone = CALLOUT[block.tone];
        return (
          <aside key={key} className={cn('rounded-[22px] border p-5', tone.shell)}>
            <div className="flex items-start gap-3.5">
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/8',
                  tone.accent
                )}
              >
                <tone.Icon className="size-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                {block.title && (
                  <p className={cn('text-sm font-bold', tone.title)}>{block.title}</p>
                )}
                <p
                  className={cn(
                    'text-[14.5px] leading-[1.8] text-slate-200',
                    block.title && 'mt-1'
                  )}
                >
                  {renderText(block.text)}
                </p>
              </div>
            </div>
          </aside>
        );
      }

      case 'image':
        return (
          <figure key={key} className="overflow-hidden rounded-[22px] border border-white/10">
            <div className="relative aspect-[16/10] w-full bg-slate-900">
              <Image
                src={block.src}
                alt={block.alt}
                fill
                sizes="(min-width: 1024px) 720px, 100vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
            <figcaption className="bg-white/[0.03] px-4 py-3 text-[12px] leading-relaxed text-slate-400">
              {renderText(block.caption)}
            </figcaption>
          </figure>
        );

      case 'beforeAfter':
        return (
          <figure
            key={key}
            className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03]"
          >
            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              {[block.before, block.after].map((side, index) => (
                <div key={index} className="bg-[#0b1120] p-5">
                  <span
                    className={cn(
                      'inline-block rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
                      index === 0
                        ? 'border-rose-400/30 bg-rose-400/10 text-rose-300'
                        : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    )}
                  >
                    {index === 0 ? t('knowledge.before') : t('knowledge.after')}
                  </span>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-slate-300">
                    {renderText(side.caption)}
                  </p>
                </div>
              ))}
            </div>
            <figcaption className="px-5 py-3 text-[11.5px] leading-relaxed text-slate-500">
              {renderText(block.note)}
            </figcaption>
          </figure>
        );

      case 'related': {
        const related = block.slugs
          .map((slug) => knowledgeArticles.find((a) => a.slug === slug))
          .filter((a): a is KnowledgeArticle => Boolean(a));
        if (related.length === 0) return null;
        return (
          <div key={key} className="grid gap-3 sm:grid-cols-2">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/kien-thuc-thu-y/${item.slug}`}
                className="group flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:-translate-y-0.5 hover:border-sky-400/30 hover:bg-white/[0.07]"
              >
                <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-slate-800">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    loading="lazy"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[13px] font-semibold text-white transition-colors group-hover:text-sky-300">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-500">{item.readTime}</span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-sky-300"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        );
      }

      case 'cta':
        return (
          <div
            key={key}
            className="rounded-[24px] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/12 to-sky-500/10 p-6 text-center"
          >
            <p className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
              <CalendarCheck className="size-3.5" aria-hidden="true" />
              {t('knowledge.nextStep')}
            </p>
            <Link
              href={block.href}
              className="group mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 px-6 py-3 text-sm font-extrabold text-slate-950 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              {block.label}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
            <p className="mt-2.5 text-[12.5px] text-slate-400">{renderText(block.hint)}</p>
          </div>
        );

      case 'disclaimer':
        return (
          <p
            key={key}
            className="flex items-start gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3.5 text-[12.5px] leading-relaxed text-amber-100/90"
          >
            <PawPrint className="mt-0.5 size-3.5 shrink-0 text-amber-300" aria-hidden="true" />
            <span>{t('knowledge.disclaimerText')}</span>
          </p>
        );

      default:
        // Block chưa được biết đến: bỏ qua chứ không render "[object Object]".
        return null;
    }
  }

  return (
    <div className="space-y-5">
      {/* Mục lục — chỉ hiện khi bài đủ dài để nó có ích. */}
      {toc.length >= 3 && (
        <nav
          aria-label={t('knowledge.toc')}
          className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5"
        >
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            {t('knowledge.toc')}
          </p>
          <ol className="space-y-1.5">
            {toc.map((item, index) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="group flex items-start gap-2.5 text-[13.5px] leading-relaxed text-slate-300 transition-colors hover:text-sky-300"
                >
                  <span className="mt-px font-mono text-[10px] text-slate-600 group-hover:text-sky-400">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{renderText(item.text)}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {article.sections.map((block, index) => renderBlock(block, index))}
    </div>
  );
}