import NextAuth, { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Client from "@/models/Client";
import { JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }
        await dbConnect();
        const user = await User.findOne({ email: credentials.email });

        if (user) {
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) {
            throw new Error("Invalid password");
          }
          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            accountType: "staff",
          };
        }

        const client = await Client.findOne({ email: credentials.email }).select(
          "_id name email password portalAccessEnabled"
        );

        if (!client || !client.portalAccessEnabled || !client.password) {
          throw new Error("No account found with this email");
        }

        const isClientPasswordValid = await bcrypt.compare(credentials.password, client.password);
        if (!isClientPasswordValid) {
          throw new Error("Invalid password");
        }

        return {
          id: client._id.toString(),
          name: client.name,
          email: client.email,
          role: "client",
          accountType: "client",
          clientId: client._id.toString(),
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: JWT;
      user?: { id?: string; role?: string; accountType?: "staff" | "client"; clientId?: string };
    }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as string;
        token.accountType = user.accountType as "staff" | "client";
        token.clientId = user.clientId as string | undefined;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as {
          id?: string;
          role?: string;
          accountType?: "staff" | "client";
          clientId?: string;
        }).id = token.id as string;
        (session.user as {
          id?: string;
          role?: string;
          accountType?: "staff" | "client";
          clientId?: string;
        }).role = token.role as string;
        (session.user as {
          id?: string;
          role?: string;
          accountType?: "staff" | "client";
          clientId?: string;
        }).accountType = token.accountType as "staff" | "client";
        (session.user as {
          id?: string;
          role?: string;
          accountType?: "staff" | "client";
          clientId?: string;
        }).clientId = token.clientId as string | undefined;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
