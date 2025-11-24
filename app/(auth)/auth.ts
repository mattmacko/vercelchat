import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { DUMMY_PASSWORD } from "@/lib/constants";
import {
  convertGuestUserToOAuth,
  createGuestUser,
  createOAuthUser,
  getUser,
  getUserByEmail,
  getUserByGoogleId,
  linkGoogleAccount,
} from "@/lib/db/queries";
import { logError, logInfo, maskEmail } from "@/lib/logging";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular" | "pro";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
  }

  // biome-ignore lint/nursery/useConsistentTypeDefinitions: "Required"
  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    googleId?: string;
  }
}

const mapUserTypeFromRecord = (dbUser: {
  tier?: string | null;
  authProvider?: string | null;
}): UserType => {
  if (dbUser?.tier === "pro") {
    return "pro";
  }
  if (dbUser?.authProvider === "guest") {
    return "guest";
  }
  return "regular";
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        const userType: UserType = user.tier === "pro" ? "pro" : "regular";

        return { ...user, type: userType };
      },
    }),
    Credentials({
      id: "guest",
      credentials: {},
      async authorize() {
        const [guestUser] = await createGuestUser();
        return { ...guestUser, type: "guest" };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const emailVerified = Boolean((profile as any)?.email_verified);
        const email =
          typeof (profile as any)?.email === "string"
            ? (profile as any).email
            : null;

        if (!email || !emailVerified) {
          logError("auth:signIn", "Blocked Google sign-in", {
            reason: !email ? "missing_email" : "unverified_email",
          });
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user, account, profile }) {
      const isGoogleSignIn = account?.provider === "google";

      try {
        if (isGoogleSignIn) {
          const googleId = account.providerAccountId;
          const emailFromProfile =
            typeof (profile as any)?.email === "string"
              ? (profile as any).email
              : user?.email ?? token.email;
          const normalizedEmail = emailFromProfile?.toLowerCase() ?? null;
          const emailVerified = Boolean((profile as any)?.email_verified);
          const emailVerifiedAt = emailVerified ? new Date() : null;

          let dbUser = googleId
            ? await getUserByGoogleId(googleId)
            : null;
          const existingByEmail =
            !dbUser && normalizedEmail
              ? await getUserByEmail(normalizedEmail)
              : null;

          const isGuestSession = token.type === "guest" && Boolean(token.id);

          if (!dbUser && isGuestSession && token.id) {
            try {
              dbUser = await convertGuestUserToOAuth({
                userId: token.id,
                nextEmail:
                  normalizedEmail ?? `guest-${Date.now()}@guest.local`,
                googleId,
                emailVerifiedAt,
              });
            } catch (error) {
              logError("auth:jwt", "Guest -> Google conversion failed", {
                userId: token.id,
                email: maskEmail(normalizedEmail ?? token.email),
                error,
              });
              throw error;
            }
          }

          if (!dbUser && existingByEmail) {
            dbUser = await linkGoogleAccount({
              userId: existingByEmail.id,
              googleId,
              emailVerifiedAt,
            });
            logInfo("auth:jwt", "Linked Google to existing user", {
              userId: existingByEmail.id,
              email: maskEmail(existingByEmail.email),
            });
          }

          if (!dbUser) {
            const [createdUser] = await createOAuthUser({
              email:
                normalizedEmail ?? `${googleId}@google-oauth.local`,
              googleId,
              emailVerifiedAt,
            });
            dbUser = createdUser;
            logInfo("auth:jwt", "Created new Google user", {
              userId: dbUser.id,
              email: maskEmail(dbUser.email),
            });
          }

          token.id = dbUser.id;
          token.type = mapUserTypeFromRecord(dbUser);
          token.email = dbUser.email;
          token.googleId = dbUser.googleId ?? googleId;

          return token;
        }

        if (user) {
          token.id = user.id as string;
          token.type = (user as any).type as UserType;
          token.email = user.email ?? token.email;
        }

        if (!token.type && token.email) {
          const dbUser = await getUserByEmail(token.email);
          if (dbUser) {
            token.id = dbUser.id;
            token.type = mapUserTypeFromRecord(dbUser);
            token.googleId = dbUser.googleId ?? token.googleId;
          }
        }

        return token;
      } catch (error) {
        logError("auth:jwt", "JWT callback failed", { error });
        if (isGoogleSignIn) {
          throw error;
        }
        return token;
      }
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        session.user.email = token.email ?? session.user.email;
      }

      return session;
    },
    redirect({ url, baseUrl }) {
      try {
        const targetUrl = new URL(url, baseUrl);
        if (targetUrl.origin === baseUrl) {
          return targetUrl.toString();
        }
      } catch (error) {
        logError("auth:redirect", "Redirect callback failed", { error });
      }

      return baseUrl;
    },
  },
});
