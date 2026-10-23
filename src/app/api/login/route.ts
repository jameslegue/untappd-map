import { NextResponse } from "next/server";
import { checkPassword, issueSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !checkPassword(password)) {
    // Slow down guessing a little
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await issueSession();
  return NextResponse.json({ ok: true });
}
