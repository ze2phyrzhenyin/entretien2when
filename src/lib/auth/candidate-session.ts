import { cookies } from "next/headers";
import { InterviewGroupStatus } from "@prisma/client";
import { getSessionCookiePath } from "@/lib/app-url";
import { prisma } from "@/lib/db/prisma";
import { shouldUseSecureAdminCookie } from "@/lib/auth/session";
import {
  generateCandidateToken,
  hashCandidateToken,
  isCandidateToken
} from "@/lib/auth/candidate-token";

export const CANDIDATE_SESSION_COOKIE_NAME = "interview_candidate_session";

function getCandidateSessionExpiresAt(now = new Date()) {
  const ttlDays = Number.parseInt(process.env.CANDIDATE_SESSION_TTL_DAYS ?? "14", 10);
  const safeTtlDays = Number.isSafeInteger(ttlDays) && ttlDays > 0 ? ttlDays : 14;
  return new Date(now.getTime() + safeTtlDays * 24 * 60 * 60 * 1000);
}

export function getCandidateSessionCookieOptions(expiresAt: Date, basePath?: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: shouldUseSecureAdminCookie(),
    path: getSessionCookiePath(basePath),
    expires: expiresAt
  };
}

type CandidateSessionWithGroup = {
  groupId: string;
  expiresAt: Date;
  group: {
    status: InterviewGroupStatus;
  };
};

class CandidateAccessTokenUnavailableError extends Error {
  constructor() {
    super("Candidate access token is unavailable.");
    this.name = "CandidateAccessTokenUnavailableError";
  }
}

/**
 * A group that is not OPEN accepts neither a new magic-link claim nor an
 * existing candidate session. Closure suspends credentials without deleting
 * their audit rows; if an administrator later reopens the group, an
 * unexpired session or unconsumed link becomes usable again.
 */
export function isCandidateSessionUsable(
  session: CandidateSessionWithGroup | null,
  groupId?: string,
  now = Date.now()
) {
  return Boolean(
    session &&
    session.expiresAt.getTime() > now &&
    session.group.status === InterviewGroupStatus.OPEN &&
    (!groupId || session.groupId === groupId)
  );
}

export async function consumeCandidateAccessToken(token: string) {
  if (!isCandidateToken(token)) {
    return null;
  }

  const tokenHash = hashCandidateToken(token);
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      // Claim the link with a single conditional UPDATE. Only one concurrent
      // request can change consumedAt from NULL, and session creation occurs
      // in the same transaction so a failed create rolls the claim back.
      const claimed = await tx.candidateAccessToken.updateMany({
        where: {
          tokenHash,
          consumedAt: null,
          expiresAt: { gt: now }
        },
        data: { consumedAt: now }
      });

      if (claimed.count !== 1) {
        return null;
      }

      const accessToken = await tx.candidateAccessToken.findUnique({
        where: { tokenHash },
        select: {
          groupId: true,
          name: true,
          email: true,
          normalizedEmail: true,
          group: {
            select: {
              groupCode: true,
              status: true
            }
          }
        }
      });

      if (!accessToken || accessToken.group.status !== InterviewGroupStatus.OPEN) {
        // Throwing rolls the conditional update back. A link for a closed
        // group is therefore rejected without being burned.
        throw new CandidateAccessTokenUnavailableError();
      }

      const candidate = await tx.candidate.findUnique({
        where: {
          groupId_normalizedEmail: {
            groupId: accessToken.groupId,
            normalizedEmail: accessToken.normalizedEmail
          }
        },
        select: { id: true }
      });

      const rawSessionToken = generateCandidateToken();
      const expiresAt = getCandidateSessionExpiresAt(now);

      await tx.candidateSession.create({
        data: {
          groupId: accessToken.groupId,
          candidateId: candidate?.id ?? null,
          tokenHash: hashCandidateToken(rawSessionToken),
          name: accessToken.name,
          email: accessToken.email,
          normalizedEmail: accessToken.normalizedEmail,
          expiresAt
        }
      });

      return {
        sessionToken: rawSessionToken,
        expiresAt,
        groupCode: accessToken.group.groupCode
      };
    });
  } catch (error) {
    if (error instanceof CandidateAccessTokenUnavailableError) {
      return null;
    }
    throw error;
  }
}

export async function getCurrentCandidateSession(groupId?: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CANDIDATE_SESSION_COOKIE_NAME)?.value;
  if (!token || !isCandidateToken(token)) {
    return null;
  }

  const session = await prisma.candidateSession.findUnique({
    where: {
      tokenHash: hashCandidateToken(token)
    },
    include: {
      group: {
        select: {
          id: true,
          groupCode: true,
          status: true
        }
      }
    }
  });

  if (!isCandidateSessionUsable(session, groupId)) {
    return null;
  }

  return session;
}
