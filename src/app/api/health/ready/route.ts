import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "interview-scheduler-cn",
      status: "ready",
      commit: process.env.GIT_SHA ?? null
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "interview-scheduler-cn",
        status: "not-ready"
      },
      { status: 503 }
    );
  }
}
