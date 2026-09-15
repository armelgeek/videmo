-- MagicLink table
CREATE TABLE IF NOT EXISTS "MagicLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP NOT NULL,
    "usedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MagicLink_token_idx" ON "MagicLink"("token");
CREATE INDEX IF NOT EXISTS "MagicLink_email_idx" ON "MagicLink"("email");

-- PendingEmailChange table
CREATE TABLE IF NOT EXISTS "PendingEmailChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PendingEmailChange_token_idx" ON "PendingEmailChange"("token");
CREATE INDEX IF NOT EXISTS "PendingEmailChange_userId_idx" ON "PendingEmailChange"("userId");

-- RecoveryCode table
CREATE TABLE IF NOT EXISTS "RecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL UNIQUE,
    "usedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- TrustedDevice table
CREATE TABLE IF NOT EXISTS "TrustedDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP NOT NULL,
    "lastUsedAt" TIMESTAMP NOT NULL,
    "revokedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TrustedDevice_token_idx" ON "TrustedDevice"("token");
CREATE INDEX IF NOT EXISTS "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");
