import { handleCallback } from "@/server/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handleCallback(req);
}
