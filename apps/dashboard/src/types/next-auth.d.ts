import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    workspaceId?: string;
    role?: string;
    user: {
      id?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    workspaceId?: string;
    role?: string;
  }
}
