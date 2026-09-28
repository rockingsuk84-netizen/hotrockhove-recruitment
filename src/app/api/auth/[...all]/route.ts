import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Better Auth endpoints (session refresh, sign-out). Public sign-up is disabled in lib/auth.ts.
export const { GET, POST } = toNextJsHandler(auth);
