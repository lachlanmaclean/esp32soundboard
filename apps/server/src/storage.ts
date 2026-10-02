import crypto from "crypto";
import fs from "fs";
import path from "path";
import { env } from "./env";
import { opusPathFor } from "./audio";

// Canonical copies live here, one per distinct file hash, regardless of how
// many Sound rows (even across users) reference that same audio. Each row's
// own audioUrl is a hardlink into this directory - not a symlink, which
// needs elevated privileges to create on Windows and would break local dev
// there. A hardlink also means the OS itself tracks the reference count, so
// deleting one user's sound can never take the bytes another one still
// points at down with it.
export const originalsDir = path.join(env.uploadDir, "originals");
fs.mkdirSync(originalsDir, { recursive: true });

export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

export function canonicalAudioPath(fileHash: string, ext: string) {
  return path.join(originalsDir, `${fileHash}${ext}`);
}

/**
 * Takes a freshly uploaded file, moves it into the hash-addressed originals
 * store (or discards it as a duplicate if that hash already exists), and
 * replaces it with a hardlink at its original path so the upload's public
 * URL doesn't change. Returns the hash and the canonical path, for pre-encoding.
 */
export async function deduplicateUpload(uploadedPath: string, ext: string) {
  const fileHash = await hashFile(uploadedPath);
  const canonicalPath = canonicalAudioPath(fileHash, ext);

  if (fs.existsSync(canonicalPath)) {
    fs.unlinkSync(uploadedPath);
  } else {
    fs.renameSync(uploadedPath, canonicalPath);
  }

  fs.linkSync(canonicalPath, uploadedPath);
  return { fileHash, canonicalPath };
}

/**
 * Removes a sound's hardlink, and the shared canonical file too if no other
 * Sound row still references the same hash. Called after the DB row is
 * already deleted, so `remainingReferences` should exclude it.
 */
export function removeUploadedFile(filePath: string, canonicalPath: string, remainingReferences: number) {
  fs.unlink(filePath, () => {});

  if (remainingReferences === 0) {
    fs.unlink(canonicalPath, () => {});
    fs.unlink(opusPathFor(canonicalPath), () => {});
  }
}
