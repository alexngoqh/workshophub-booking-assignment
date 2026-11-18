import { PrismaClient } from '@prisma/client'

// SQLite serialises writers, so concurrent registrations/cancellations queue behind
// each other. Prisma's defaults (maxWait 2s, timeout 5s) are too tight on slow CI
// runners; give queued interactive transactions more headroom.
const prisma = new PrismaClient({
  transactionOptions: { maxWait: 15_000, timeout: 15_000 },
})

export default prisma
