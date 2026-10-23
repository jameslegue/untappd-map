import { NextResponse } from "next/server";
import { getCheckins } from "@/lib/store";
import { isUnlocked } from "@/lib/auth";
import type { Payload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body: Payload = { mode: "private", checkins: await getCheckins() };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
