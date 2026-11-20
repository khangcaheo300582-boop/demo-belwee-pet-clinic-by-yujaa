"use client";

// components/staff/FileUploadModal.tsx
// Liquid drag & drop upload zone used on the staff dashboard.
// - Drag active → border-radius morphs (animate-fluid-wobble) + emerald glow rim
// - Uploading  → emerald "water" rises from the bottom of the zone (0% → 100%)
// - Persists diagnose / treatment / files to PATCH /api/staff/records/:id

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Loader2, Paperclip, Save, Trash2, UploadCloud, X, Wand2 } from 'lucide-react';
import type { MedicalFile, MedicalRecord } from '@/lib/dbMedicalRecords';
import { cn } from '@/lib/utils';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain';

interface FileUploadModalProps {
  record: MedicalRecord;
  onClose: () => void;
  onSaved: (record: MedicalRecord) => void;
}

export default function FileUploadModal({ record, onClose, onSaved }: FileUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyFiles, setBusyFiles] = useState<string[]>([]);
  const [diagnose, setDiagnose] = useState(record.diagnose ?? '');
  const [treatment, setTreatment] = useState(record.treatment ?? '');
  const [files, setFiles] = useState<MedicalFile[]>(record.files ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC to close — suppressed while an upload or save is in flight, because
  // closing then would silently discard bytes the server already accepted.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, uploading, saving]);

  // Lock the page behind so it cannot scroll under the card.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const uploadOne = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/staff/upload', { method: 'POST', body: fd });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(data?.message || `Tải "${file.name}" thất bại.`);
    }
    const data = (await res.json()) as { file: MedicalFile };
    return data.file;
  }, []);

  async function handleFiles(list: File[]) {
    const candidates = list.filter(f => {
      const okType = ACCEPT.split(',').includes(f.type);
      const okSize = f.size <= 10 * 1024 * 1024;
      return okType && okSize;
    });
    if (candidates.length === 0) {
      setError('Chỉ chấp nhận ảnh / PDF / txt, tối đa 10 MB mỗi file.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const uploaded: MedicalFile[] = [];
      for (const file of candidates) {
        setBusyFiles(prev => [...prev, file.name]);
        try {
          uploaded.push(await uploadOne(file));
        } finally {
          setBusyFiles(prev => prev.filter(n => n !== file.name));
        }
      }
      setFiles(prev => {
        const seen = new Set(prev.map(f => f.id));
        return [...prev, ...uploaded.filter(f => !seen.has(f.id))];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi khi tải file lên.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/records/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnose: diagnose.trim() || null,
          treatment: treatment.trim() || null,
          files,
        }),
      });
      const data = (await res.json()) as { record?: MedicalRecord; message?: string };
      if (!res.ok || !data.record) {
        throw new Error(data.message || 'Lưu không thành công.');
      }
      onSaved(data.record);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu không thành công.');
    } finally {
      setSaving(false);
    }
  }

  function removeFile(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  return (
    // Centre BOTH axes. The old overlay was `items-end sm:items-center` with
    // `p-0 sm:p-6`: on desktop the card centred vertically, but a tall card
    // (the diagnosis textarea + drop zone + file list together exceed 85vh on a
    // laptop) grew downward off-screen with no way to reach the Save button —
    // `items-center` clips both ends of an overflowing flex child.
    // `overflow-y-auto` + `margin: auto` centres when it fits and scrolls the
    // overlay when it does not.
    <div
      className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-slate-950/75 p-4 py-[6vh] backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget && !uploading && !saving) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="diagnosis-modal-title"
        style={{ margin: 'auto' }}
        initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 16, scale: 0.97, filter: 'blur(6px)' }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-[28px] border border-white/15 bg-[#0b1120]/90 p-6 shadow-spatial-depth backdrop-blur-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="diagnosis-modal-title" className="text-lg font-extrabold text-white">
              Cập nhật bệnh án
            </h2>
            <p className="text-sm text-white/55">
              {record.petName} · {record.service}
              {record.ownerName ? ` · Chủ: ${record.ownerName}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/45">
              <Wand2 className="size-3.5 text-emerald-300" /> Chẩn đoán của bác sĩ
            </label>
            <textarea
              value={diagnose}
              onChange={e => setDiagnose(e.target.value)}
              rows={3}
              placeholder="Nhập chẩn đoán, kết quả xét nghiệm…"
              className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none backdrop-blur-xl transition-all placeholder:text-white/30 focus:border-emerald-300/50 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/45">Hướng điều trị / tái khám</label>
            <textarea
              value={treatment}
              onChange={e => setTreatment(e.target.value)}
              rows={2}
              placeholder="Đơn thuốc, lịch tái khám…"
              className="w-full resize-none rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white outline-none backdrop-blur-xl transition-all placeholder:text-white/30 focus:border-emerald-300/50 focus:shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"
            />
          </div>

          {/* ── Liquid drop zone ─────────────────────────────────── */}
          <div
            onDragOver={e => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={e => {
              e.preventDefault();
              setIsDragActive(false);
            }}
            onDrop={e => {
              e.preventDefault();
              setIsDragActive(false);
              const list = Array.from(e.dataTransfer.files || []);
              void handleFiles(list);
            }}
            onClick={() => !uploading && inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            className={cn(
              'relative cursor-pointer overflow-hidden border-2 border-dashed px-6 py-10 text-center outline-none transition-colors duration-300',
              isDragActive
                ? 'animate-fluid-wobble border-emerald-300/80 bg-emerald-400/10 shadow-[0_0_0_4px_rgba(52,211,153,0.18),inset_0_1px_1px_rgba(255,255,255,0.2)]'
                : 'rounded-3xl border-white/20 bg-white/5 hover:border-white/35 hover:bg-white/10'
            )}
          >
            {/* Water fill (0% → 100%) while uploading */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0"
              initial={false}
              animate={{ height: uploading ? '100%' : '0%' }}
              transition={{ duration: uploading ? 1.6 : 0.4, ease: 'linear' }}
              style={{ background: 'linear-gradient(180deg, rgba(52,211,153,0.05), rgba(16,185,129,0.28))' }}
            />
            <div className="relative z-10 flex flex-col items-center gap-2">
              {uploading ? (
                <>
                  <Loader2 className="size-8 animate-spin text-emerald-300" />
                  <p className="text-sm font-semibold text-emerald-200">Đang dâng nước… tải {busyFiles.length > 0 ? `"${busyFiles[busyFiles.length - 1]}"` : 'file'} lên</p>
                </>
              ) : (
                <>
                  <UploadCloud className={cn('size-8 transition-colors', isDragActive ? 'text-emerald-300' : 'text-white/45')} />
                  <p className="text-sm font-semibold text-white/80">
                    {isDragActive ? 'Thả ra để tải lên ✨' : 'Kéo thả file vào đây, hoặc bấm để chọn'}
                  </p>
                  <p className="text-xs text-white/40">Ảnh (JPG/PNG/WebP/GIF), PDF, TXT · tối đa 10 MB/file</p>
                </>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={e => {
                const list = Array.from(e.target.files || []);
                void handleFiles(list);
                e.target.value = '';
              }}
            />
          </div>

          {error && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
              {error}
            </motion.p>
          )}

          {/* File chips */}
          <AnimatePresence initial={false}>
            {files.length > 0 && (
              <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                {files.map(f => (
                  <motion.li
                    key={f.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <FileText className="size-4 shrink-0 text-sky-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/85">{f.name}</p>
                      <p className="text-[11px] text-white/40">
                        {(f.size / 1024).toFixed(f.size > 1024 * 1024 ? 1 : 0)} KB · {f.fileType}
                      </p>
                    </div>
                    <a href={f.fileUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/50 hover:text-white">
                      <Paperclip className="size-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      className="rounded-full border border-red-300/20 bg-red-500/10 p-1.5 text-red-300 transition-colors hover:bg-red-500/25"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-3 text-sm font-extrabold text-slate-950 shadow-liquid-glow-emerald transition-all hover:bg-emerald-300 disabled:opacity-60"
          >
            {saving ? <Loader2 className="size-4.5 animate-spin" /> : <Save className="size-4.5" />}
            {saving ? 'Đang lưu…' : 'Lưu bệnh án'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
