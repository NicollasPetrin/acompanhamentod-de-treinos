-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "photoUrl" TEXT,
    "birthDate" DATETIME,
    "sex" TEXT,
    "heightCm" REAL,
    "weightKg" REAL,
    "goal" TEXT,
    "level" TEXT,
    "weightUnit" TEXT NOT NULL DEFAULT 'kg',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "accentColor" TEXT NOT NULL DEFAULT 'verde',
    "trainingDays" TEXT NOT NULL DEFAULT '[]',
    "defaultRestSec" INTEGER NOT NULL DEFAULT 90,
    "remindersOn" BOOLEAN NOT NULL DEFAULT false,
    "reminderTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("birthDate", "createdAt", "defaultRestSec", "email", "goal", "heightCm", "id", "level", "name", "passwordHash", "photoUrl", "reminderTime", "remindersOn", "sex", "theme", "trainingDays", "updatedAt", "weightKg", "weightUnit") SELECT "birthDate", "createdAt", "defaultRestSec", "email", "goal", "heightCm", "id", "level", "name", "passwordHash", "photoUrl", "reminderTime", "remindersOn", "sex", "theme", "trainingDays", "updatedAt", "weightKg", "weightUnit" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
