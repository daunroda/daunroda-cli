import type { PathLike } from "node:fs";
import { access, mkdir } from "node:fs/promises";

/**
 * Asynchronously checks if the given path exists
 * @param path The path to check for existence
 * @returns `true` if the path exists, `false` otherwise
 */
export async function exists(path: PathLike): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively creates a directory if it does not exist.
 * @param path The path to check for existence and create if it doesn't exist.
 */
export async function ensureDir(path: PathLike): Promise<void> {
  if (!(await exists(path)))
    await mkdir(path, {
      recursive: true,
      mode: 0o777
    });
}
