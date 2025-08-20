import "next-auth";
import { type DefaultSession, type DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      admin: boolean;
      apipie_key?: string | null;
    } & DefaultSession["user"];
    accessToken?: string;
  }

  interface User extends DefaultUser {
    id: string;
    admin: boolean;
    apipie_key?: string | null;
  }
}
