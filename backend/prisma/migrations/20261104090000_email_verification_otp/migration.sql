ALTER TABLE "AuthToken" ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0;

-- Verification links are replaced by email codes. Password reset links remain valid.
UPDATE "AuthToken" SET "usedAt" = CURRENT_TIMESTAMP
WHERE "purpose" = 'VERIFY_EMAIL' AND "usedAt" IS NULL;
