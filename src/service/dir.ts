// SPDX-FileCopyrightText: 2026 https://github.com/kurtzhi/fsext-mcp-server-typescript
// SPDX-License-Identifier: Apache-2.0

/*
 * Copyright 2026 https://github.com/kurtzhi/fsext-mcp-server-typescript
 *
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


/**
 * Directory service module providing directory traversal, copy and move utilities.
 * All methods throw descriptive exceptions for invalid path, permission and input arguments.
 */

import {constants, existsSync} from 'fs'
import {cp, rename, readdir, stat, unlink, rmdir, access} from 'fs/promises';
import {basename, resolve, dirname, join} from 'path';

import * as check from './check.utils.js';


/**
 * Recursively scan directory and return absolute paths of matched entries.
 * @param sourceDir Root directory to scan.
 * @param recursive Enable deep subdirectory traversal.
 * @param onlyFiles Filter output to regular files only, skip directories.
 * @param fileExtension Optional suffix filter (e.g. ".txt"), case-insensitive match.
 * @returns Promise of absolute path string array for matched entries.
 */
export async function listDirectory(
    sourceDir: string,
    recursive: boolean,
    onlyFiles: boolean,
    fileExtension?: string
): Promise<string[]> {
    await check.requireReadableDirectory(sourceDir, 'sourceDir');

    const extRaw = (
        fileExtension ?? ''
    ).trim();
    const extension = extRaw ? extRaw.toLowerCase() : '';
    const needFilterExt = !!extension;

    const results: string[] = [];

    async function walkShallow(currentDir: string) {
        const entries = await readdir(currentDir, {withFileTypes: true});
        for (const entry of entries) {
            const fullPath = resolve(currentDir, entry.name);
            const fileName = entry.name.toLowerCase();
            const isFile = entry.isFile();
            const isDir = entry.isDirectory();

            if (onlyFiles && isDir) continue;

            let match = true;
            if (needFilterExt && isFile) {
                match = fileName.endsWith(extension);
            }

            if (match) {
                results.push(fullPath);
            }
        }
    }

    async function walkRecursive(currentDir: string) {
        const entries = await readdir(currentDir, {withFileTypes: true});
        const dirList: string[] = [];
        const fileList: string[] = [];

        for (const entry of entries) {
            const fullPath = resolve(currentDir, entry.name);
            if (entry.isDirectory()) {
                dirList.push(fullPath);
            } else if (entry.isFile()) {
                fileList.push(fullPath);
            }
        }

        if (!onlyFiles) {
            for (const d of dirList) {
                results.push(d);
            }
        }

        for (const f of fileList) {
            const fileName = basename(f).toLowerCase();
            if (!needFilterExt || fileName.endsWith(extension)) {
                results.push(f);
            }
        }

        if (recursive) {
            for (const d of dirList) {
                await walkRecursive(d);
            }
        }
    }

    if (recursive) {
        await walkRecursive(sourceDir);
    } else {
        await walkShallow(sourceDir);
    }

    return results;
}

/**
 * Recursively copy entire source directory tree to destination.
 * @param sourceDir Readable source directory path.
 * @param copyDestDir Target output directory path.
 * @param overwrite Allow overwriting existing files at destination.
 */
export async function copyDirectory(
    sourceDir: string,
    copyDestDir: string,
    overwrite: boolean
): Promise<void> {
    await check.requireReadableDirectory(sourceDir, 'sourceDir');

    check.requireNonBlank(copyDestDir, 'copyDestDir');
    await check.requireWritableParentDirectory(copyDestDir, 'copyDestDir');

    await cp(sourceDir, copyDestDir, {
        recursive: true,
        force: overwrite
    });
}

/**
 * Atomic move entire source directory to target path.
 *
 * @param sourceDir source directory path
 * @param destDir target directory path
 * @param overwrite replace existing target files when true
 * @throws Error read source / write target permission or IO error
 */
export async function moveDirectory(
    sourceDir: string,
    destDir: string,
    overwrite: boolean
): Promise<void> {
    // Require non-blank path check
    if (!sourceDir?.trim()) {
        throw new Error('sourceDir must not be blank');
    }
    if (!destDir?.trim()) {
        throw new Error('destDir must not be blank');
    }

    const source = resolve(sourceDir);
    const target = resolve(destDir);

    // Verify source exists and is a readable directory
    const sourceStats = await stat(source);
    if (!sourceStats.isDirectory()) {
        throw new Error(`sourceDir is not a directory: ${sourceDir}`);
    }
    await access(source, constants.R_OK);

    // Verify target parent directory is writable
    const targetParent = dirname(target);
    await access(targetParent, constants.W_OK);

    // Handle existing target directory
    if (existsSync(target)) {
        if (overwrite) {
            await cleanDirIfExists(target);
        } else {
            throw new Error(`Target directory already exists: ${destDir}`);
        }
    }

    // Perform directory move
    await rename(source, target);
}

/**
 * Recursively delete directory if it exists
 * @param dirPath absolute path of directory to delete
 */
async function cleanDirIfExists(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) return;

    const entries = await readdir(dirPath, {withFileTypes: true});
    for (const entry of entries) {
        const fullEntryPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
            await cleanDirIfExists(fullEntryPath);
        } else {
            await unlink(fullEntryPath);
        }
    }

    // Remove empty directory after all contents deleted
    await rmdir(dirPath);
}