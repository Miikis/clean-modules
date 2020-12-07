import { Dirent, promises as fsPromise } from 'fs';
import path from 'path';

export type DirentAction = (dirent: Dirent) => void;
export type CheckFunc = (nextPath: string) => boolean;

export async function readDirentsAsync(dirPath: string, action: DirentAction): Promise<void> {
  const dirFiles = await fsPromise.readdir(dirPath, { withFileTypes: true });
  await Promise.all(dirFiles.map(action));
}

export async function isEmptyDir(dirPath: string) {
  const files = await fsPromise.readdir(dirPath);
  return files.length === 0;
}

export async function removeEmptyDirsUp(
  checkedDirs: Set<string>,
  dirPath: string,
  count: number = 0
): Promise<number> {
  if (!checkedDirs.has(dirPath)) {
    const files = await fsPromise.readdir(dirPath);
    const isEmptyDir = files.length === 0;
    checkedDirs.add(dirPath);

    if (isEmptyDir) {
      try {
        await fsPromise.rmdir(dirPath);
        count++;
      } catch (error) {}

      const parentDir = path.dirname(dirPath);
      count = await removeEmptyDirsUp(checkedDirs, parentDir, count);
    }
  }

  return count;
}

// Find all files in a directory as fast as possible, without any extra checks or validations.
export async function crawlDirFast(filePaths: string[], dirPath: string): Promise<void> {
  await readDirentsAsync(dirPath, async dirent => {
    const nextPath = `${dirPath}/${dirent.name}`;

    if (dirent.isDirectory()) {
      await crawlDirFast(filePaths, nextPath);
    } else {
      filePaths.push(nextPath);
    }
  });
}


// Crawl files and validate them against glob patterns.
export async function crawlDirWithChecks(
  filePaths: string[], // Mutate array to avoid losing speed on spreading
  dirPath: string,
  checkDir: CheckFunc,
  checkFile: CheckFunc
): Promise<string[]> {
  await readDirentsAsync(dirPath, async dirent => {
    const nextPath = `${dirPath}/${dirent.name}`;

    if (dirent.isDirectory()) {
      if (checkDir(nextPath)) {
        // If a full directory matches, include all of it.
        await crawlDirFast(filePaths, nextPath);
      } else {
        // Keep recursively checking each directory
        await crawlDirWithChecks(filePaths, nextPath, checkDir, checkFile);
      }
    } else if (checkFile(nextPath)) {
      filePaths.push(nextPath);
    }
  });

  return filePaths;
}
