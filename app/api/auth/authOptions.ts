import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { dbUser } from '@/lib/dbUser';
import { login } from '@/lib/auth-service';
import { CUSTOMER_IDLE_TIMEOUT_MS } from '@/lib/session-policy';

const googleProvider = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  ? GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  : null;

export const authOptions: AuthOptions = {
  providers: [
    ...(googleProvider ? [googleProvider] : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { type: 'text' },
        password: { type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const result = await login(credentials.email, credentials.password);
        if (!result.ok || !result.user) return null;
        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          image: (result.user as any).image ?? null,
        };
      }
    })
  ],

  session: { strategy: 'jwt', maxAge: CUSTOMER_IDLE_TIMEOUT_MS / 1000 },

  callbacks: {
    async redirect({ url, baseUrl }) {
      // BUGFIX (3000→3001 redirect): never resolve relative URLs against
      // NEXTAUTH_URL / NEXT_PUBLIC_BASE_URL — that env var can be pinned to a
      // stale port (e.g. :3001) and NextAuth then bounces the browser there.
      // Keep relative URLs relative so the browser stays on the origin it
      // actually connected to.
      if (url.startsWith('/')) return url;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },

    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && account.providerAccountId && user?.email) {
        if (profile && 'email_verified' in profile && profile.email_verified === false) {
          return false;
        }

        const normalizedEmail = user.email.toLowerCase().trim();
        const userWithGoogleId = await dbUser.findByGoogleId(account.providerAccountId);
        if (userWithGoogleId && userWithGoogleId.email !== normalizedEmail) {
          return false;
        }

        const existingUser = await dbUser.findByEmail(normalizedEmail);
        if (existingUser) {
          await dbUser.linkGoogleAccount(normalizedEmail, account.providerAccountId, user.image);
          user.id = existingUser.id;
          user.name = existingUser.name || user.name;
        } else {
          const newUser = await dbUser.create({
            email: normalizedEmail,
            password: '',
            name: user.name || normalizedEmail.split('@')[0],
            provider: 'google',
            googleId: account.providerAccountId,
            image: user.image,
          });
          user.id = newUser.id;
        }
      }
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.provider = user.provider;
        token.lastActivity = Date.now();
        delete token.inactive;
      }
      const lastActivity = typeof token.lastActivity === 'number' ? token.lastActivity : 0;
      if (!lastActivity || Date.now() - lastActivity >= CUSTOMER_IDLE_TIMEOUT_MS) {
        token.inactive = true;
        return token;
      }
      if (trigger === 'update' && session?.activity === true) {
        token.lastActivity = Date.now();
        delete token.inactive;
      }
      return token;
    },

    // Keep NextAuth on the origin the browser actually used. Any absolute URL
    // pointing at another origin (e.g. a stale :3001 NEXTAUTH_URL) is dropped.

    async session({ session, token }) {
      if (token.inactive === true) {
        session.expires = new Date(0).toISOString();
        if (session.user) {
          session.user.email = null;
          session.user.name = null;
          session.user.image = null;
        }
        return session;
      }
      if (session.user && typeof token.id === 'string') session.user.id = token.id;
      return session;
    }
  },

  pages: { signIn: '/dang-nhap', error: '/dang-nhap' },
  // Development may use a local-only fallback; production must configure a secret.
  secret: process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === 'development' ? 'belwee-development-only-secret' : undefined),
};
