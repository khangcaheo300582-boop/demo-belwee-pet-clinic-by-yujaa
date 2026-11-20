// lib/dbUser.ts
// File-based User persistence – backed by the shared lib/jsonStore primitive.
// Keeps data across server restarts without requiring MongoDB.

import bcrypt from 'bcryptjs';
import { createAsyncJsonStore } from './jsonStore';

export interface User {
  id: string;
  email: string;
  password: string;       // bcrypt hash
  name: string;
  image?: string | null;
  provider: 'credentials' | 'google';
  googleId?: string | null;
  /** Present on accounts imported from the legacy Mongo collection. */
  role?: string;
  /** Previous bcrypt hashes, newest first. Used to refuse password reuse. */
  passwordHistory?: string[];
  /**
   * Incremented every time the password changes. NextAuth embeds this value in
   * the JWT at sign-in; a token whose epoch is older than the stored value is
   * treated as revoked. Without it, a password reset cannot invalidate an
   * already-issued stateless JWT.
   */
  sessionEpoch?: number;
  createdAt: string;
  updatedAt: string;
}

const userStore = createAsyncJsonStore<User>('users.json');

function generateUserId(): string {
  return `USR_${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export class DuplicateUserError extends Error {
  constructor() {
    super('A user with this email or provider ID already exists.');
    this.name = 'DuplicateUserError';
  }
}

export function isDuplicateUserError(error: unknown): boolean {
  return error instanceof DuplicateUserError;
}

// ─── CRUD Operations ────────────────────────────────────────────────
export const dbUser = {
  /** Find user by email */
  async findByEmail(email: string): Promise<User | undefined> {
    const rows = await userStore.read();
    return rows.find((u) => u.email === email.toLowerCase().trim());
  },

  /** Find user by Google provider account ID */
  async findByGoogleId(googleId: string): Promise<User | undefined> {
    const rows = await userStore.read();
    return rows.find((u) => u.googleId === googleId);
  },

  /** Find user by ID */
  async findById(id: string): Promise<User | undefined> {
    const rows = await userStore.read();
    return rows.find((u) => u.id === id);
  },

  /** Check if email already exists */
  async emailExists(email: string): Promise<boolean> {
    const rows = await userStore.read();
    return rows.some((u) => u.email === email.toLowerCase().trim());
  },

  /** Create a new user with hashed password */
  async create(data: {
    email: string;
    password: string;
    name: string;
    provider?: 'credentials' | 'google';
    googleId?: string;
    image?: string | null;
  }): Promise<User> {
    const passwordHash = data.provider === 'google' ? '' : await bcrypt.hash(data.password, 12);
    const now = new Date().toISOString();
    const user: User = {
      id: generateUserId(),
      email: data.email.toLowerCase().trim(),
      password: passwordHash,
      name: data.name.trim(),
      image: data.image || null,
      provider: data.provider || 'credentials',
      ...(data.googleId ? { googleId: data.googleId } : {}),
      sessionEpoch: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Duplicate check + write happen atomically inside the store mutex.
    return userStore.update((rows) => {
      if (rows.some((u) => u.email === user.email)) {
        throw new DuplicateUserError();
      }
      if (data.googleId && rows.some((u) => u.googleId === data.googleId)) {
        throw new DuplicateUserError();
      }
      rows.push(user);
      return user;
    });
  },

  /** Link a Google account to an existing local account */
  async linkGoogleAccount(email: string, googleId: string, image?: string | null): Promise<User | undefined> {
    const targetEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();
    return userStore.update((rows) => {
      const idx = rows.findIndex((u) => u.email === targetEmail);
      if (idx === -1) return undefined;
      rows[idx] = {
        ...rows[idx],
        googleId,
        provider: 'google',
        ...(image ? { image } : {}),
        updatedAt: now,
      };
      return rows[idx];
    });
  },

  /** Verify password against stored hash */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  },

  /** Update password after reset */
  async updatePassword(email: string, newPassword: string): Promise<boolean> {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();
    const targetEmail = email.toLowerCase().trim();
    return userStore.update((rows) => {
      const idx = rows.findIndex((u) => u.email === targetEmail);
      if (idx === -1) return false;
      rows[idx] = {
        ...rows[idx],
        password: passwordHash,
        updatedAt: now,
      };
      return true;
    });
  },

  /**
   * Replace a password and push the previous hash into the history in a single
   * store transaction. Callers pass the already-computed hash so the expensive
   * bcrypt work happens outside the store's lock.
   *
   * Returns `undefined` when no user has that id.
   */
  async rotatePassword(
    id: string,
    newPasswordHash: string,
    historySize: number
  ): Promise<User | undefined> {
    const now = new Date().toISOString();
    const limit = Math.max(0, historySize);
    return userStore.update((rows) => {
      const idx = rows.findIndex((u) => u.id === id);
      if (idx === -1) return undefined;

      const current = rows[idx];
      const history = [current.password, ...(current.passwordHistory ?? [])]
        .filter((hash): hash is string => typeof hash === 'string' && hash.length > 0)
        .slice(0, limit);

      rows[idx] = {
        ...current,
        password: newPasswordHash,
        ...(limit > 0 ? { passwordHistory: history } : {}),
        // Bumping the epoch is what makes a password change invalidate JWTs
        // that were issued before it. Keep it in the same transaction as the
        // hash so the two can never disagree.
        sessionEpoch: (current.sessionEpoch ?? 0) + 1,
        updatedAt: now,
      };
      return rows[idx];
    });
  },

  /** Update user profile fields */
  async updateProfile(id: string, data: Partial<Pick<User, 'name' | 'image'>>): Promise<User | undefined> {
    const now = new Date().toISOString();
    return userStore.update((rows) => {
      const idx = rows.findIndex((u) => u.id === id);
      if (idx === -1) return undefined;
      rows[idx] = {
        ...rows[idx],
        ...data,
        updatedAt: now,
      };
      return rows[idx];
    });
  },

  /** Update user profile by email (used by migration scripts) */
  async updateProfileByEmail(email: string, data: Partial<Omit<User, 'id' | 'email' | 'provider' | 'googleId' | 'createdAt'>>): Promise<boolean> {
    const targetEmail = email.toLowerCase().trim();
    const now = new Date().toISOString();
    return userStore.update((rows) => {
      const idx = rows.findIndex((u) => u.email === targetEmail);
      if (idx === -1) return false;
      rows[idx] = {
        ...rows[idx],
        ...data,
        email: targetEmail,
        updatedAt: now,
      };
      return true;
    });
  },

  /** Read all users (used by migration scripts) */
  async readAll(): Promise<User[]> {
    return userStore.read();
  },
};
