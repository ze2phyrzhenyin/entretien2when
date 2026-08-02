import { NextResponse, type NextRequest } from "next/server";
import { getRequestBasePath } from "@/lib/app-url";
import { getCurrentCandidateSession } from "@/lib/auth/candidate-session";
import { prisma } from "@/lib/db/prisma";
import {
  isSupportedLocale,
  localeCookieName,
  localeCookieOptions,
  type AppLocale
} from "@/i18n/config";

type LocaleRequest = { locale?: unknown; groupCode?: unknown };

export async function POST(request: NextRequest) {
  let body: LocaleRequest;
  try {
    body = (await request.json()) as LocaleRequest;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_LOCALE_REQUEST" } }, { status: 400 });
  }
  if (!isSupportedLocale(body.locale)) {
    return NextResponse.json({ error: { code: "UNSUPPORTED_LOCALE" } }, { status: 400 });
  }

  if (typeof body.groupCode === "string" && body.groupCode.length <= 64) {
    const group = await prisma.interviewGroup.findUnique({
      where: { groupCode: body.groupCode },
      select: { id: true }
    });
    if (group) {
      const session = await getCurrentCandidateSession(group.id);
      if (session) {
        await prisma.$transaction(async (tx) => {
          await tx.candidateSession.updateMany({
            where: { id: session.id, groupId: group.id },
            data: { locale: body.locale as AppLocale }
          });
          if (session.candidateId) {
            await tx.candidate.updateMany({
              where: { id: session.candidateId, groupId: group.id },
              data: { preferredLocale: body.locale as AppLocale }
            });
          }
        });
      }
    }
  }

  const response = NextResponse.json({ locale: body.locale });
  response.cookies.set(
    localeCookieName,
    body.locale,
    localeCookieOptions(getRequestBasePath(request.nextUrl.basePath))
  );
  return response;
}
