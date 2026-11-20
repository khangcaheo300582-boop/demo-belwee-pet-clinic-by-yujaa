/**
 * lib/staffProfiles.ts
 * The four Belwee employees shown on the homepage and the Team page.
 *
 * WHY THIS FILE EXISTS
 * Those two pages were rendering two DIFFERENT rosters: the homepage showed
 * four cards and /doi-ngu showed six doctors from lib/teamData (the
 * "chuyên gia tư vấn" roster, which keeps its own bio pages under
 * /doi-ngu/[slug]). Both were labelled "đội ngũ", so a customer who compared
 * the two pages found no overlap at all.
 *
 * This is the single source for the four employees. Add someone here and both
 * pages pick them up.
 *
 * Images live in /public. `initial` is the fallback avatar shown while the real
 * photo loads, and is also used if the file is ever removed — the grid never
 * renders a broken <img>.
 */

import type { StaffJobTitle } from './staffShared';

export interface StaffProfile {
  id: string;
  jobTitle: StaffJobTitle;
  dateOfBirth?: string | null;
  branchId?: string | null;
  /** Chức danh — matches StaffJobTitle labels where one exists. */
  title: string;
  titleEn: string;
  name: string;
  /** Short line under the name (chi nhánh / vai trò). */
  branch: string;
  branchEn: string;
  /** Emoji used for the fallback avatar tile. */
  emoji: string;
  image: string;
  bioVi: string;
  bioEn: string;
}

export const STAFF_PROFILES: readonly StaffProfile[] = [
  {
    id: 'phan-thi-tu',
    jobTitle: 'CHUYEN_GIA_SPA',
    title: 'Chuyên gia thú y spa & grooming',
    titleEn: 'Spa & Grooming Specialist',
    name: 'Phan Thị Tứ',
    branch: 'Chuyên gia thú y spa & grooming',
    branchEn: 'Spa & Grooming Specialist',
    emoji: '✂️',
    image: '/phanthitu.png',
    bioVi:
      'Chuyên gia thú y spa & grooming CG. Phan Thị Tứ phụ trách toàn bộ hành trình làm đẹp cho thú cưng tại Belwee — tắm, cắt tỉa lông, chăm sóc da & tai, cắt móng và khử mùi.',
    bioEn:
      'CG. Phan Thị Tứ leads the whole grooming journey at Belwee — bathing, coat trimming, skin and ear care, nail clipping and deodorising.',
  },
  {
    id: 'ta-trung-nguyen',
    jobTitle: 'THUC_TAP_SINH',
    title: 'Thực tập sinh',
    titleEn: 'Veterinary Intern',
    name: 'Tạ Trung Nguyên',
    branch: 'Thực tập sinh thú y',
    branchEn: 'Veterinary Intern',
    emoji: '🎓',
    image: '/tatrungnguyen.png',
    bioVi:
      'TT. Tạ Trung Nguyên hỗ trợ đội ngũ bác sĩ trong khám bệnh, theo dõi bệnh án và chăm sóc thú cưng tại khuôn viên Belwee dưới sự hướng dẫn trực tiếp.',
    bioEn:
      'TT. Tạ Trung Nguyên assists the veterinary team with consultations, record-keeping and in-clinic care under direct supervision.',
  },
  {
    id: 'le-nguyen-vu',
    jobTitle: 'BAC_SI',
    title: 'Bác sĩ',
    titleEn: 'Veterinary Doctor',
    name: 'Lê Nguyên Vũ',
    branch: 'Bác sĩ thú y',
    branchEn: 'Veterinary Doctor',
    emoji: '🩺',
    image: '/lenguyenvu.png',
    bioVi:
      'BS. Lê Nguyên Vũ khám và điều trị bệnh cho chó mèo, thực hiện các thủ thuật nội trú và chăm sóc theo dõi sát từng bé trong suốt quá trình điều trị.',
    bioEn:
      'Dr. Lê Nguyên Vũ examines and treats dogs and cats, performs inpatient procedures and closely monitors every patient through recovery.',
  },
  {
    id: 'dinh-phan-huu-khang',
    jobTitle: 'MARKETING',
    title: 'Marketing',
    titleEn: 'Marketing',
    name: 'Đinh Phan Hữu Khang',
    branch: 'Marketing',
    branchEn: 'Marketing',
    emoji: '📣',
    image: '/dinhphanhuukhang.png',
    bioVi:
      'MK. Đinh Phan Hữu Khang phụ trách truyền thông và nội dung của Belwee, đồng thời là đầu mối tiếp nhận phản hồi từ khách hàng để cải thiện trải nghiệm tại phòng khám.',
    bioEn:
      'MK. Đinh Phan Hữu Khang handles Belwee communications and content, and is the contact point for customer feedback feeding service improvements.',
  },
] as const;

/**
 * Fallback avatar for a profile with no photo file.
 *
 * Returns null when the profile HAS an image, so callers only render the tile
 * when they genuinely need it.
 */
export function staffFallbackAvatar(profile: StaffProfile): string | null {
  return profile.image ? null : profile.emoji;
}

/** Full display name with the title prefix, e.g. "BS. Lê Nguyên Vũ". */
export function staffDisplayName(profile: StaffProfile): string {
  // The stored `title` is the long form ("Chuyên gia thú y spa & grooming"),
  // but titles read as "CG." / "TT." / "BS." / "MK." in a card. Derive the
  // short form from the long one rather than storing both and risking drift.
  return `${staffTitleShort(profile.title)} ${profile.name}`.trim();
}

/** The "CG." / "TT." / "BS." / "MK." abbreviation for a long-form title. */
export function staffTitleShort(title: string): string {
  const short: Record<string, string> = {
    'Chuyên gia thú y spa & grooming': 'CG.',
    'Thực tập sinh': 'TT.',
    'Bác sĩ': 'BS.',
    Marketing: 'MK.',
    'Quản trị viên': 'QT.',
  };
  return short[title] ?? '';
}