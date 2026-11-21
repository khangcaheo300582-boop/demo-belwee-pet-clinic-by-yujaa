// lib/dbMedicalRecords.ts
// File-backed medical records (data/records.json).
//
// Receipt and attachment metadata are embedded in each record; uploaded file
// contents stay on disk under data/uploads and are referenced by URL.
//
// WHY FILE-BACKED: this module used to be the largest consumer of mongoose in
// the app. Every staff dashboard read, portal read and receipt write waited on
// an Atlas cluster that was frequently unreachable, which turned a working
// dashboard into a 10-second spinner and then a 500. The data it manages is a
// single JSON file, and lib/jsonStore already provides atomic writes plus
// in-process serialisation for the read-modify-write paths below.

import { createAsyncJsonStore } from './jsonStore';

// ─── Types ─────────────────────────────────────────────────────────
export type RecordStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED';

export interface MedicalFile {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  size: number;
  uploadedAt: string;
}

export interface ReceiptItem {
  name: string;
  price: number;
  qty: number;
}

export interface Receipt {
  id: string;
  items: ReceiptItem[];
  totalAmount: number;
  note?: string | null;
  createdAt: string;
}

export interface MedicalRecord {
  id: string;
  /** Booking id this record was created from (staff dashboard workflow). */
  bookingId?: string | null;
  petName: string;
  petType: string;            // 'Cún' | 'Mèo' | 'Khác'
  ownerEmail: string;
  ownerName: string;
  service: string;
  status: RecordStatus;
  diagnose?: string | null;
  treatment?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  scheduledAt?: string | null; // ISO datetime (tương thích cũ)
  /** Mốc tiêm vắc-xin/tiêm ngừa tiếp theo — đầu tuần nhắc engine gửi. Thay thế text trong `treatment`. */
  nextDoseDueAt?: string | null;
  /** Mốc tái khám/xét nghiệm định kỳ — đầu tuần nhắc engine gửi. */
  followUpDueAt?: string | null;
  files: MedicalFile[];
  receipt?: Receipt | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Thrown when a booking already owns a medical record.
 *
 * The staff dashboard calls ensureLinkedRecord() on demand, and two staff
 * members can open the same appointment at once. The second writer must not
 * create a duplicate record — it should fall back to the one that won. A typed
 * error makes that branch explicit instead of matching a Mongo error code that
 * no longer exists.
 */
export class DuplicateMedicalRecordError extends Error {
  constructor() {
    super('A medical record already exists for this booking.');
    this.name = 'DuplicateMedicalRecordError';
  }
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function isoDaysFromNow(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function normalizeFile(value: unknown): MedicalFile | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.fileUrl !== 'string') return null;
  return {
    id: row.id,
    name: typeof row.name === 'string' ? row.name : '',
    fileUrl: row.fileUrl,
    fileType: typeof row.fileType === 'string' ? row.fileType : '',
    size: Number.isFinite(Number(row.size)) ? Number(row.size) : 0,
    uploadedAt: typeof row.uploadedAt === 'string' ? row.uploadedAt : new Date(0).toISOString(),
  };
}

function normalizeReceipt(value: unknown): Receipt | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !Array.isArray(row.items)) return null;
  return {
    id: row.id,
    items: row.items
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        name: String(item.name ?? ''),
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 0,
      })),
    totalAmount: Number(row.totalAmount) || 0,
    note: typeof row.note === 'string' ? row.note : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
  };
}

/**
 * data/records.json is hand-editable and predates a few optional fields, so
 * every read fills the gaps rather than trusting the file's shape. Missing
 * arrays would otherwise crash `.map()` in the portal and dashboard.
 */
const recordStore = createAsyncJsonStore<MedicalRecord>('records.json', (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
    .filter((row) => typeof row.id === 'string' && typeof row.ownerEmail === 'string')
    .map((row) => ({
      id: row.id as string,
      bookingId: typeof row.bookingId === 'string' ? row.bookingId : null,
      petName: typeof row.petName === 'string' ? row.petName : '',
      petType: typeof row.petType === 'string' ? row.petType : 'Khác',
      ownerEmail: (row.ownerEmail as string).toLowerCase().trim(),
      ownerName: typeof row.ownerName === 'string' ? row.ownerName : '',
      service: typeof row.service === 'string' ? row.service : '',
      status: row.status === 'COMPLETED' ? 'COMPLETED' : row.status === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING',
      diagnose: typeof row.diagnose === 'string' ? row.diagnose : null,
      treatment: typeof row.treatment === 'string' ? row.treatment : null,
      staffId: typeof row.staffId === 'string' ? row.staffId : null,
      staffName: typeof row.staffName === 'string' ? row.staffName : null,
      scheduledAt: typeof row.scheduledAt === 'string' ? row.scheduledAt : null,
      files: Array.isArray(row.files) ? row.files.map(normalizeFile).filter((file): file is MedicalFile => !!file) : [],
      receipt: normalizeReceipt(row.receipt),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date(0).toISOString(),
    }));
});

function paginate<T>(rows: T[], options: { page?: number; limit?: number }): T[] {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.max(1, Math.min(100, options.limit ?? 100));
  return rows.slice((page - 1) * limit, page * limit);
}

// ─── Demo seed ──────────────────────────────────────────────────────
/**
 * Marker email reserved for demo records. These exist ONLY for the customer
 * portal's pre-login preview – staff-facing views (receipts archive, records
 * list) must never surface them as if they were real operations.
 */
export const DEMO_OWNER_EMAIL = 'demo@belwee.vn';

/**
 * Auto-create a small set of demo medical records the first time the store is empty.
 * Gives /client-portal real content instantly. Staff surfaces read through
 * dbMedicalRecords.list() / listWithReceipt(), which exclude demo rows.
 */
export async function ensureSeedMedicalRecords(): Promise<{ seeded: boolean }> {
  if (process.env.ALLOW_SEED === 'false') {
    return { seeded: false };
  }

  // Fast path: never rewrite the file on a page load that has nothing to seed.
  // update() always writes, and this function is called on every portal render.
  if ((await recordStore.read()).length > 0) {
    return { seeded: false };
  }

  const now = new Date().toISOString();
  const demoEmail = DEMO_OWNER_EMAIL;
  const vet = { staffId: 'STF_DEMO001', staffName: 'BS. Lê Minh Châu' };

  const records: MedicalRecord[] = [
    {
      id: 'MR_DEMO_001',
      petName: 'Bông',
      petType: 'Cún',
      ownerEmail: demoEmail,
      ownerName: 'Minh Anh',
      service: 'Khám tổng quát',
      status: 'COMPLETED',
      diagnose: 'Sức khỏe ổn định, cân nặng đạt chuẩn theo giống. Không phát hiện bất thường lâm sàng.',
      treatment: 'Tiếp tục chế độ ăn hiện tại, tái khám sau 6 tháng.',
      ...vet,
      scheduledAt: isoDaysFromNow(-14, 9),
      followUpDueAt: isoDaysFromNow(6 * 30, 9),
      files: [],
      receipt: {
        id: generateId('RC'),
        items: [
          { name: 'Khám tổng quát', price: 250000, qty: 1 },
          { name: 'Xét nghiệm máu tổng phân tích', price: 400000, qty: 1 },
        ],
        totalAmount: 650000,
        note: 'Đã thanh toán tại quầy.',
        createdAt: now,
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'MR_DEMO_002',
      petName: 'Miu',
      petType: 'Mèo',
      ownerEmail: demoEmail,
      ownerName: 'Minh Anh',
      service: 'Tiêm phòng dại',
      status: 'COMPLETED',
      diagnose: 'Tiêm vaccine phòng dại định kỳ. Theo dõi 30 phút sau tiêm, không ghi nhận phản ứng phụ.',
      treatment: 'Nhắc lịch tiêm nhắc lại sau 1 năm.',
      ...vet,
      scheduledAt: isoDaysFromNow(-6, 15),
      // Nhắc engine (data-driven, thay vì parse text trong treatment): tiêm lại sau 1 năm
      nextDoseDueAt: isoDaysFromNow(365, 10),
      files: [],
      receipt: {
        id: generateId('RC'),
        items: [
          { name: 'Vaccine dại + công tiêm', price: 300000, qty: 1 },
          { name: 'Vệ sinh tai', price: 80000, qty: 1 },
        ],
        totalAmount: 380000,
        createdAt: now,
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'MR_DEMO_003',
      petName: 'Bông',
      petType: 'Cún',
      ownerEmail: demoEmail,
      ownerName: 'Minh Anh',
      service: 'Spa & Grooming',
      status: 'CONFIRMED',
      diagnose: null,
      treatment: null,
      staffId: 'STF_DEMO002',
      staffName: 'ThS. Trần Thị Bình',
      scheduledAt: isoDaysFromNow(1, 10),
      files: [],
      receipt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'MR_DEMO_004',
      petName: 'Milo',
      petType: 'Cún',
      ownerEmail: demoEmail,
      ownerName: 'Quốc Bảo',
      service: 'Khám da liễu',
      status: 'PENDING',
      diagnose: null,
      treatment: null,
      staffId: null,
      staffName: null,
      scheduledAt: isoDaysFromNow(2, 14),
      files: [],
      receipt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return recordStore.update((rows) => {
    // Another request may have seeded while this one waited for the lock.
    if (rows.length > 0) return { seeded: false };
    const existingIds = new Set(rows.map((row) => row.id));
    const missing = records.filter((record) => !existingIds.has(record.id));
    rows.push(...missing);
    return { seeded: missing.length > 0 };
  });
}

// ─── CRUD Operations ────────────────────────────────────────────────
export const dbMedicalRecords = {
  /** Staff-facing list: excludes demo rows (reserved for the customer portal). */
  async list(options: { page?: number; limit?: number; staffId?: string } = {}): Promise<MedicalRecord[]> {
    const rows = (await recordStore.read())
      .filter((record) => record.ownerEmail !== DEMO_OWNER_EMAIL)
      .filter((record) => !options.staffId || record.staffId === options.staffId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return paginate(rows, options);
  },

  async findById(id: string): Promise<MedicalRecord | undefined> {
    return (await recordStore.read()).find((record) => record.id === id);
  },

  async findOwnersByFileUrl(fileUrl: string): Promise<string[]> {
    return (await recordStore.read())
      .filter((record) => record.files.some((file) => file.fileUrl === fileUrl))
      .map((record) => record.ownerEmail.toLowerCase().trim());
  },

  async findByOwnerEmail(email: string, options: { page?: number; limit?: number } = {}): Promise<MedicalRecord[]> {
    const normalized = email.toLowerCase().trim();
    const rows = (await recordStore.read())
      .filter((record) => record.ownerEmail === normalized)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return paginate(rows, options);
  },

  /** Tìm bệnh án theo booking gốc (mỗi booking tối đa một bệnh án). */
  async findByBookingId(bookingId: string): Promise<MedicalRecord | undefined> {
    return (await recordStore.read()).find((record) => record.bookingId === bookingId);
  },

  async create(data: Omit<MedicalRecord, 'id' | 'createdAt' | 'updatedAt' | 'files' | 'receipt'> & { files?: MedicalFile[]; receipt?: Receipt | null }): Promise<MedicalRecord> {
    return recordStore.update((rows) => {
      if (data.bookingId && rows.some((record) => record.bookingId === data.bookingId)) {
        throw new DuplicateMedicalRecordError();
      }
      const now = new Date().toISOString();
      const record: MedicalRecord = {
        ...data,
        id: generateId('MR'),
        files: data.files || [],
        receipt: data.receipt ?? null,
        createdAt: now,
        updatedAt: now,
      };
      rows.push(record);
      return { ...record };
    });
  },

  /** Partial update of a record. Returns undefined when id not found. */
  async update(id: string, patch: Partial<Pick<MedicalRecord, 'status' | 'diagnose' | 'treatment' | 'staffId' | 'staffName' | 'files' | 'receipt' | 'scheduledAt' | 'nextDoseDueAt' | 'followUpDueAt'>>): Promise<MedicalRecord | undefined> {
    return recordStore.update((rows) => {
      const record = rows.find((candidate) => candidate.id === id);
      if (!record) return undefined;
      Object.assign(record, patch, { updatedAt: new Date().toISOString() });
      return { ...record };
    });
  },

  /**
   * Attach a medical file list (merge, dedupe by id).
   *
   * This used to read the store, compute the merge, throw the result away and
   * then call this.update() — which read the store a second time. Between those
   * two reads another writer could land, so the merge was computed against a
   * snapshot that was already stale. Now it is a single read → mutate → write.
   */
  async addFiles(id: string, files: MedicalFile[]): Promise<MedicalRecord | undefined> {
    return recordStore.update((rows) => {
      const record = rows.find((candidate) => candidate.id === id);
      if (!record) return undefined;
      const seen = new Set(record.files.map((file) => file.id));
      for (const file of files) {
        if (seen.has(file.id)) continue;
        seen.add(file.id);
        record.files.push(file);
      }
      record.updatedAt = new Date().toISOString();
      return { ...record, files: record.files.map((file) => ({ ...file })) };
    });
  },

  /** Create a receipt for a record; also flips status → COMPLETED. */
  async createReceipt(id: string, items: ReceiptItem[], note?: string | null): Promise<{ record?: MedicalRecord; error?: string }> {
    const safeItems = items
      .map(i => ({
        name: String(i.name).trim(),
        price: Number(i.price),
        qty: Number(i.qty),
      }))
      .filter(i => i.name.length > 0);
    if (safeItems.length === 0) return { error: 'Hoá đơn cần ít nhất một dịch vụ.' };
    if (safeItems.some((item) => !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.qty) || item.qty < 1)) {
      return { error: 'Giá và số lượng dịch vụ không hợp lệ.' };
    }

    const totalAmount = safeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const receipt: Receipt = {
      id: generateId('RC'),
      items: safeItems,
      totalAmount,
      note: note || null,
      createdAt: new Date().toISOString(),
    };

    return recordStore.update((rows) => {
      const record = rows.find((candidate) => candidate.id === id);
      if (!record) return { error: 'Không tìm thấy bệnh án.' };
      if (record.receipt) return { error: 'Bệnh án này đã có hoá đơn.' };

      record.receipt = receipt;
      record.status = 'COMPLETED';
      record.updatedAt = new Date().toISOString();
      return { record: { ...record, receipt: { ...receipt, items: receipt.items.map((item) => ({ ...item })) } } };
    });
  },

  async listWithReceipt(options: { page?: number; limit?: number } = {}): Promise<MedicalRecord[]> {
    const rows = (await recordStore.read())
      .filter((record) => !!record.receipt && record.ownerEmail !== DEMO_OWNER_EMAIL)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return paginate(rows, options);
  },

  /** Toàn bộ records (bao gồm demo) – dùng cho map lookup theo bookingId. */
  async listAll(options: { page?: number; limit?: number } = {}): Promise<MedicalRecord[]> {
    const rows = (await recordStore.read()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, options);
  },

  /** Tra bệnh án cho nhiều booking trong MỘT lần đọc file (O(n) thay vì O(n²)). */
  async listByBookingIds(bookingIds: string[]): Promise<Map<string, MedicalRecord>> {
    const map = new Map<string, MedicalRecord>();
    if (bookingIds.length === 0) return map;
    const wanted = new Set(bookingIds);
    for (const record of await recordStore.read()) {
      if (record.bookingId && wanted.has(record.bookingId)) map.set(record.bookingId, record);
    }
    return map;
  },
};

// Re-exported helpers for id generation elsewhere (uploads etc.)
export const generateRecordId = () => generateId('MR');
