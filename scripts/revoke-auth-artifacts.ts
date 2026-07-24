import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hasConfirmation() {
  return process.argv.slice(2).includes("--confirm");
}

async function main() {
  if (!hasConfirmation()) {
    throw new Error(
      "Refusing to revoke credentials without --confirm. This invalidates every admin and candidate session plus every unconsumed candidate access link."
    );
  }

  const [adminSessions, candidateSessions, candidateAccessTokens] = await prisma.$transaction([
    prisma.adminSession.deleteMany(),
    prisma.candidateSession.deleteMany(),
    prisma.candidateAccessToken.deleteMany({ where: { consumedAt: null } })
  ]);

  console.log(
    JSON.stringify({
      revokedAdminSessions: adminSessions.count,
      revokedCandidateSessions: candidateSessions.count,
      revokedCandidateAccessTokens: candidateAccessTokens.count
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
