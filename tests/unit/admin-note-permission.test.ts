import { AdminRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireGroupPermission: vi.fn(),
  transaction: vi.fn(),
  candidateFindFirst: vi.fn(),
  noteFindFirst: vi.fn(),
  noteCreate: vi.fn(),
  noteUpdate: vi.fn(),
  auditCreate: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("@/lib/auth/session", () => ({
  requireAdmin: mocks.requireAdmin
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

vi.mock("@/lib/permissions/admin", () => ({
  groupCandidateCareRoles: ["OWNER", "SCHEDULER", "REVIEWER"],
  requireGroupPermission: mocks.requireGroupPermission
}));

import { upsertCandidateAdminNoteAction } from "@/server/actions/admin-note";

const transactionClient = {
  candidate: {
    findFirst: mocks.candidateFindFirst
  },
  candidateAdminNote: {
    findFirst: mocks.noteFindFirst,
    create: mocks.noteCreate,
    update: mocks.noteUpdate
  },
  auditLog: {
    create: mocks.auditCreate
  }
};

function noteFormData() {
  const formData = new FormData();
  formData.set("body", "跟进备注");
  return formData;
}

describe("candidate admin-note authorization", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.requireAdmin.mockResolvedValue({
      id: "admin_a",
      role: AdminRole.ADMIN
    });
    mocks.requireGroupPermission.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
  });

  it("rejects a candidate from another group before any note or audit write", async () => {
    mocks.candidateFindFirst.mockResolvedValue(null);

    await expect(
      upsertCandidateAdminNoteAction("group_a", "candidate_b", noteFormData())
    ).rejects.toThrow("候选人不属于该面试组");

    expect(mocks.candidateFindFirst).toHaveBeenCalledWith({
      where: { id: "candidate_b", groupId: "group_a" },
      select: { id: true }
    });
    expect(mocks.noteFindFirst).not.toHaveBeenCalled();
    expect(mocks.noteCreate).not.toHaveBeenCalled();
    expect(mocks.noteUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("writes a note and audit entry only after candidate/group binding succeeds", async () => {
    mocks.candidateFindFirst.mockResolvedValue({ id: "candidate_a" });
    mocks.noteFindFirst.mockResolvedValue(null);
    mocks.noteCreate.mockResolvedValue({ id: "note_a" });
    mocks.auditCreate.mockResolvedValue({ id: "audit_a" });

    await upsertCandidateAdminNoteAction("group_a", "candidate_a", noteFormData());

    expect(mocks.noteCreate).toHaveBeenCalledWith({
      data: {
        groupId: "group_a",
        candidateId: "candidate_a",
        authorAdminId: "admin_a",
        body: "跟进备注"
      }
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "group_a",
        entityId: "note_a",
        action: "admin.upsert_candidate_admin_note"
      })
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/groups/group_a/candidates/candidate_a"
    );
  });
});
