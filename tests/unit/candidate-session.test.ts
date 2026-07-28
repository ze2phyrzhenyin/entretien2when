import { afterEach, describe, expect, it, vi } from "vitest";
import { InterviewGroupStatus } from "@prisma/client";
import {
  getCandidateSessionCookieName,
  getCandidateSessionCookieOptions,
  isCandidateSessionUsable
} from "@/lib/auth/candidate-session";
import { generateCandidateToken, isCandidateToken } from "@/lib/auth/candidate-token";

describe("candidate session boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses only expected opaque token values", () => {
    expect(isCandidateToken(generateCandidateToken())).toBe(true);
    expect(isCandidateToken("short")).toBe(false);
    expect(isCandidateToken("x".repeat(4_096))).toBe(false);
  });

  it("suspends a session immediately when its group closes", () => {
    const session = {
      groupId: "group-a",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      group: { status: InterviewGroupStatus.CLOSED }
    };

    expect(isCandidateSessionUsable(session, "group-a", Date.parse("2029-01-01T00:00:00Z"))).toBe(
      false
    );
  });

  it("requires the expected group and scopes candidate cookies to the application path", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/when2entretien");
    vi.stubEnv("NODE_ENV", "production");
    const session = {
      groupId: "group-a",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      group: { status: InterviewGroupStatus.OPEN }
    };

    expect(isCandidateSessionUsable(session, "group-b", Date.parse("2029-01-01T00:00:00Z"))).toBe(
      false
    );
    expect(isCandidateSessionUsable(session, "group-a", Date.parse("2029-01-01T00:00:00Z"))).toBe(
      true
    );
    expect(getCandidateSessionCookieOptions(session.expiresAt)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/when2entretien"
    });
  });

  it("derives stable, non-secret cookie names per group", () => {
    const groupACookie = getCandidateSessionCookieName("group-a");
    const groupBCookie = getCandidateSessionCookieName("group-b");

    expect(groupACookie).toMatch(/^interview_candidate_session_[A-Za-z0-9_-]{18}$/);
    expect(groupACookie).not.toContain("group-a");
    expect(groupACookie).not.toBe(groupBCookie);
    expect(getCandidateSessionCookieName("group-a")).toBe(groupACookie);
  });
});
