import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Adapter } from "next-auth/adapters";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user?.passwordHash) return null;
        const ok = await compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email!,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.workspaceId = (token as { workspaceId?: string }).workspaceId;
      }
      if (trigger === "update" && session) {
        const s = session as { workspaceId?: string; role?: string };
        if (s.workspaceId && token.id) {
          const member = await prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: token.id as string,
                workspaceId: s.workspaceId,
              },
            },
          });
          if (member) {
            token.workspaceId = member.workspaceId;
            token.role = member.role;
          }
        }
      }
      if (token.id && !token.workspaceId) {
        const member = await prisma.workspaceMember.findFirst({
          where: { userId: token.id as string },
        });
        if (member) {
          token.workspaceId = member.workspaceId;
          token.role = member.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session as { workspaceId?: string }).workspaceId =
          token.workspaceId as string;
        (session as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  events: {},
};
