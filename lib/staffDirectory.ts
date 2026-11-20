import { STAFF_PROFILES } from './staffProfiles';
import { JOB_TITLE_LABELS, type StaffPublic } from './staffShared';

function normalizeName(name: string): string {
  return name.trim().normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

export function buildStaffDirectory(records: StaffPublic[], selfStaffId: string) {
  const consumed = new Set<string>();
  const profiles = STAFF_PROFILES.map((profile) => {
    const profileName = normalizeName(profile.name);
    const matches = records
      .filter(
        (member) =>
          member.profileId === profile.id ||
          (!member.profileId && normalizeName(member.fullName) === profileName)
      )
      .sort((a, b) => {
        const linked = Number(b.profileId === profile.id) - Number(a.profileId === profile.id);
        if (linked !== 0) return linked;
        const active = Number(b.isActive) - Number(a.isActive);
        if (active !== 0) return active;
        return (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '');
      });
    const account = matches[0];
    matches.forEach((member) => consumed.add(member.id));

    return {
      id: account?.id ?? `profile-${profile.id}`,
      profileId: profile.id,
      fullName: profile.name,
      name: profile.name,
      email: account?.email ?? null,
      avatarUrl: profile.image || account?.avatarUrl || null,
      bio: profile.bioVi || account?.bio || '',
      role: account?.role ?? null,
      jobTitle: account?.jobTitle ?? profile.jobTitle,
      jobTitleLabel: profile.title,
      branchId: profile.branchId ?? account?.branchId ?? null,
      dateOfBirth: profile.dateOfBirth ?? account?.dateOfBirth ?? null,
      isActive: account?.isActive ?? true,
      isSelf: account?.id === selfStaffId,
      online: Boolean(account?.lastLoginAt && Date.now() - new Date(account.lastLoginAt).getTime() < 5 * 60 * 1000),
      lastLoginAt: account?.lastLoginAt ?? null,
      rulesAcknowledgedAt: account?.rulesAcknowledgedAt ?? null,
      rulesVersion: account?.rulesVersion ?? null,
      createdAt: account?.createdAt ?? null,
      isPublicProfile: true,
    };
  });

  const accounts = records
    .filter((member) => !consumed.has(member.id))
    .map((member) => ({
      id: member.id,
      ...(member.profileId ? { profileId: member.profileId } : {}),
      fullName: member.fullName,
      name: member.name,
      email: member.email,
      avatarUrl: member.avatarUrl,
      bio: member.bio,
      role: member.role,
      jobTitle: member.jobTitle,
      jobTitleLabel: JOB_TITLE_LABELS[member.jobTitle] ?? member.jobTitle,
      branchId: member.branchId,
      dateOfBirth: member.dateOfBirth,
      isActive: member.isActive,
      isSelf: member.id === selfStaffId,
      online: Boolean(member.lastLoginAt && Date.now() - new Date(member.lastLoginAt).getTime() < 5 * 60 * 1000),
      lastLoginAt: member.lastLoginAt,
      rulesAcknowledgedAt: member.rulesAcknowledgedAt,
      rulesVersion: member.rulesVersion,
      createdAt: member.createdAt,
    }));

  return [...accounts, ...profiles].sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
}
