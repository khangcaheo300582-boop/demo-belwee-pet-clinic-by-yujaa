// scripts/verify-rsc-imports.ts
// Chốt chặn cho ranh giới Server ↔ Client Component của App Router.
//
// VÌ SAO FILE NÀY TỒN TẠI
//   `AuthMode` từng là `export enum` trong components/staff/StaffAuthCard.tsx —
//   một file "use client". Cả app/staff/login/page.tsx lẫn
//   app/staff/register/page.tsx là SERVER component và import nó:
//
//     import StaffAuthCard, { AuthMode } from '@/components/staff/StaffAuthCard';
//
//   `enum` của TypeScript biên dịch thành một object runtime, nên `AuthMode` là
//   một export runtime KHÔNG phải component của một client module. Server
//   component chạm vào nó thì RSC bundler cố resolve nó như một client
//   reference, mà React Client Manifest không có mục tương ứng:
//
//     Could not find the module
//     ".../StaffAuthCard.tsx#AuthMode#Login" in the React Client Manifest.
//     This is probably a bug of the React Server Components bundler.
//
//   `/staff/login` vẫn trả HTTP 200 — nhưng RSC payload hỏng, và server log lặp
//   lại lỗi đó ở mọi lần render. Đây đúng loại lỗi TypeScript không bắt được:
//   `import` vẫn hợp lệ về mặt type, chỉ là sai ở tầng bundler.
//
// PHẠM VI HẸP — CHỈ OBJECT VÀ FUNCTION, KHÔNG PHẢI HẰNG NGUYÊN THUỶ
//   Đã kiểm chứng trên bản build thật: `THEME_INIT_SCRIPT` trong
//   components/ThemeProvider.tsx CŨNG là `export const` của một module
//   "use client", và app/layout.tsx import nó để nhét vào thẻ <script>. Nó
//   KHÔNG vỡ — RSC payload chứa đúng chuỗi script (đã đọc lại từ DOM để xác
//   nhận). Khác biệt là nó là CHUỖI nguyên thuỷ, nên bundler nội tuyến được;
//   object (`enum`, object literal) và function thì không.
//
//   Vì vậy script này cố tình KHÔNG báo lỗi cho hằng nguyên thuỷ. Báo lỗi cho
//   chúng sẽ ra một danh sách dài toàn false positive và mất ý nghĩa.
//
// Run with: npx tsx scripts/verify-rsc-imports.ts

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, why: string) {
  if (ok) {
    passed += 1;
    console.log(`  + ${label}`);
  } else {
    failed += 1;
    console.log(`  x ${label}`);
    console.log(`      ${why}`);
  }
}

const root = resolve(__dirname, '..');

/** Bỏ qua node_modules/.next và các thư mục sinh ra lúc build. */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-dev',
  '.git',
  'out',
  'public',
  'scripts',
  '.agents',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const allFiles = walk(root);
const readCache = new Map<string, string>();

function read(file: string): string {
  const hit = readCache.get(file);
  if (hit !== undefined) return hit;
  const text = readFileSync(file, 'utf8');
  readCache.set(file, text);
  return text;
}

/** File có chữ "use client" ở đầu không? */
function isClientModule(file: string): boolean {
  const head = read(file).slice(0, 400);
  return /^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n|['"]use strict['"];|\s)*)['"]use client['"]/.test(head);
}

/**
 * Giải `import ... from '...'` thành đường dẫn tuyệt đối.
 * Trả `null` khi specifier không nội bộ (npm package) — ngoài phạm vi kiểm tra.
 */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('@/') && !spec.startsWith('.')) return null;
  const base = spec.startsWith('@/') ? join(root, spec.slice(2)) : resolve(dirname(fromFile), spec);
  for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts', '.jsx', '.js']) {
    if (existsSync(base + ext)) return base + ext;
  }
  return existsSync(base) ? base : null;
}

/** Tên các named import của một câu import (bỏ qua `default` và `type`). */
function namedImports(clause: string): string[] {
  const braces = clause.match(/\{([^}]*)\}/);
  if (!braces) return [];
  return braces[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim())
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

/**
 * Khai báo export nào của một module client là giá trị runtime KHÔNG nội tuyến
 * được (object / function / class), và do đó không được server component chạm vào.
 *
 * Cố tình bỏ qua: chuỗi, số, boolean, `null`, `undefined` — những thứ Next
 * inline được. Xem khối giải thích ở đầu file.
 */
function heavyExports(source: string): Set<string> {
  const heavy = new Set<string>();

  // export enum Foo { ... }  /  export const enum Foo
  for (const m of source.matchAll(/\bexport\s+(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/g)) {
    heavy.add(m[1]);
  }

  // export class Foo
  for (const m of source.matchAll(/\bexport\s+(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/g)) {
    heavy.add(m[1]);
  }

  // export function foo / export async function foo
  for (const m of source.matchAll(/\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
    heavy.add(m[1]);
  }

  // export const foo = < initializer >
  for (const m of source.matchAll(/\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+?)?=\s*/g)) {
    // CHỈ nhận diện OBJECT LITERAL ở đầu initializer, không cố phân loại "hằng
    // nguyên thuỷ" — regex không phân biệt nổi `\`...\`.trim()` (chuỗi, hợp lệ)
    // với `= {` (object, vỡ). Thu hẹp còn loại chắc chắn vỡ thì danh sách mới
    // đáng tin.
    const rest = source.slice(m.index + m[0].length, m.index + m[0].length + 200).trimStart();
    if (rest.startsWith('{') || rest.startsWith('[')) heavy.add(m[1]);
  }

  return heavy;
}

const IMPORT_RE = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

type Offence = { importer: string; target: string; spec: string; name: string; kind: string };

const offences: Offence[] = [];

for (const file of allFiles) {
  // Chỉ server component mới bị ràng buộc này. `lib/`, `middleware.ts` không nằm
  // trong RSC tree nhưng quét chung cũng vô hại.
  if (isClientModule(file)) continue;
  const source = read(file);

  for (const match of source.matchAll(IMPORT_RE)) {
    const clause = match[1];
    const spec = match[2];
    const target = resolveSpecifier(file, spec);
    if (!target) continue;
    if (!isClientModule(target)) continue;

    const heavy = heavyExports(read(target));

    for (const name of namedImports(clause)) {
      if (!heavy.has(name)) continue;
      // Được phép: import MỘT component của client module rồi dùng nó trong JSX.
      // `export function` / `export class` của component sẽ lọt qua ở trên; nếu
      // tên xuất hiện sau `<` trong file này thì nó là component, hợp lệ.
      if (new RegExp(`<\\s*(?:${name}\\b)`).test(source)) continue;

      offences.push({
        importer: relative(root, file),
        target: relative(root, target),
        spec,
        name,
        kind: /\benum\b/.test(read(target).match(new RegExp(`export\\s+(?:const\\s+)?enum\\s+${name}\\b`))?.[0] ?? '')
          ? 'enum'
          : 'object/function',
      });
    }
  }
}

console.log('\n1. Server component không import object/function từ module "use client"');

const grouped = new Map<string, Offence[]>();
for (const off of offences) {
  const key = `${off.importer} → ${off.target}`;
  const list = grouped.get(key);
  if (list) list.push(off);
  else grouped.set(key, [off]);
}

for (const [key, list] of grouped) {
  const kinds = [...new Set(list.map((o) => o.kind))].join(', ');
  check(
    `${key} (${list.map((o) => o.name).join(', ')})`,
    false,
    `server component chỉ được import *component* từ module "use client". Đây là export ${kinds} — RSC bundler sẽ ném "Could not find the module ... in the React Client Manifest". Chuyển nó sang một module chung (vd lib/staffShared.ts) rồi import từ đó.`,
  );
}

if (grouped.size === 0) {
  console.log('  + không có vi phạm nào');
  passed += 1;
}

console.log(`\nrsc-imports: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);