-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "defaultDuration" INTEGER NOT NULL DEFAULT 60,
    "tone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Series_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "physicalDescription" TEXT NOT NULL,
    "outfit" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "voiceProvider" TEXT NOT NULL,
    "voiceConfig" TEXT NOT NULL,
    "referenceImage" TEXT,
    "consistencyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "locationName" TEXT NOT NULL,
    "visualDescription" TEXT NOT NULL,
    "lighting" TEXT NOT NULL,
    "mood" TEXT NOT NULL,
    "reusable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Environment_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "currentStep" TEXT NOT NULL DEFAULT 'SERIES_SETUP',
    "scriptOverview" TEXT,
    "audioValidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Episode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "sceneOrder" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "charactersInShot" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "qcStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "qcNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryboardFrame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reusedFromScene" TEXT,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryboardFrame_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioTake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "narration" TEXT NOT NULL,
    "dialogue" TEXT NOT NULL,
    "voiceConfig" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "background" TEXT,
    "sfx" TEXT,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioTake_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoShot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sceneId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoShot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "reusable" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryAsset_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Character_seriesId_consistencyId_key" ON "Character"("seriesId", "consistencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_seriesId_episodeNumber_key" ON "Episode"("seriesId", "episodeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Scene_episodeId_sceneOrder_key" ON "Scene"("episodeId", "sceneOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StoryboardFrame_sceneId_key" ON "StoryboardFrame"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "AudioTake_sceneId_key" ON "AudioTake"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoShot_sceneId_key" ON "VideoShot"("sceneId");
