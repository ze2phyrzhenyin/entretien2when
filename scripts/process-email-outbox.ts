import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { processEmailOutboxBatch } from "../src/server/services/email-outbox";

async function main() {
  const result = await processEmailOutboxBatch({
    take: Number.parseInt(process.env.EMAIL_OUTBOX_BATCH_SIZE ?? "20", 10)
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
