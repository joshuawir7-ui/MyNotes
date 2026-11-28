import { handleLogout } from "@/server/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handleLogout(req);
}
