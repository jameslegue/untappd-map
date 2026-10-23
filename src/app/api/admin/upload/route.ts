import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/auth";
import { normalize, type ExportRow } from "@/lib/normalize";
import { upsertCheckins } from "@/lib/store";

// The admin page sends the export in chunks (Vercel caps request bodies at 4.5MB)
export async function POST(req: Request) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { rows?: ExportRow[] } | null;
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "expected { rows: [...] }" }, { status: 400 });
  }
  const valid = body.rows.filter((r) => r && r.checkin_id && r.created_at && r.beer_name);
  const saved = await upsertCheckins(valid.map(normalize));
  return NextResponse.json({ saved, skipped: body.rows.length - valid.length });
}
