import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/auth";
import { syncFromRss } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Called hourly by .github/workflows/sync.yml (Bearer CRON_SECRET),
// or by "Sync now" on /admin (session cookie).
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  if (!(secret && bearer) && !(await isUnlocked())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await syncFromRss());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
