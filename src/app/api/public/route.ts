import { NextResponse } from "next/server";
import { getCheckins } from "@/lib/store";
import { coarsen } from "@/lib/coarsen";
import type { Payload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const body: Payload = { mode: "public", checkins: coarsen(await getCheckins()) };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
