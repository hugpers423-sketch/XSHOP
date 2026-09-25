-- X-STORE production persistence: external identities, live streams and
-- idempotent checkout orders. Safe to apply to a database previously created
-- with `prisma db push` as well as to a fresh PostgreSQL database.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleSub" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'PASSWORD';

CREATE UNIQUE INDEX IF NOT EXISTS "User_externalId_key" ON "User"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_buyerId_idempotencyKey_key"
  ON "Order"("buyerId", "idempotencyKey");

CREATE TABLE IF NOT EXISTS "LiveStream" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "productName" TEXT,
  "productPrice" DECIMAL(10,2),
  "roomName" TEXT,
  "streamUrl" TEXT,
  "transport" TEXT NOT NULL DEFAULT 'livekit',
  "isLive" BOOLEAN NOT NULL DEFAULT true,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveStream_roomName_key"
  ON "LiveStream"("roomName");
CREATE INDEX IF NOT EXISTS "LiveStream_isLive_startedAt_idx"
  ON "LiveStream"("isLive", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "LiveStream_sellerId_isLive_idx"
  ON "LiveStream"("sellerId", "isLive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LiveStream_sellerId_fkey'
  ) THEN
    ALTER TABLE "LiveStream"
      ADD CONSTRAINT "LiveStream_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
