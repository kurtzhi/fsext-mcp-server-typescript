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
 * General file utility service, provides metadata query, file create/copy/move/delete operations.
 * All path input validation uses unified check_utils utilities.
 */

import {constants, createReadStream} from 'fs';
import {access, cp, stat, writeFile, unlink, mkdir} from 'fs/promises';
import {extname, resolve} from 'path';
import {createHash} from 'crypto';

import * as check from './check.utils.js';
import {requireNonBlank, requireReadableFile} from "./check.utils.js";


export interface FileInfo {
    absolute_path: string;
    is_readable: boolean;
    is_writable: boolean;
    size: number;
    is_regular_file: boolean;
    is_directory: boolean;
    is_symbolic_link: boolean;
    creation_millis: number;
    last_modified_millis: number;
    last_access_millis: number;
    sha256_digest: string;
}


/**
 * Retrieves metadata for a specified file or directory.
 * @param filePath The path to the target file or directory.
 * @param calcDigest If calculate hash digest for the given file.
 * @returns A promise that resolves to a FileInfo object.
 * @throws {Error} If an I/O error occurs.
 */
// MD5, SHA-256, SHA-512, and CRC hashes
export async function getFileInfo(filePath: string, calcDigest: boolean): Promise<FileInfo> {
    check.requireNonBlank(filePath, 'filePath');
    await check.requirePathExists(filePath, 'filePath');

    const stats = await stat(filePath);
    const absolutePath = resolve(filePath);

    // Original placeholder logic, keep signature unchanged
    const isReadable = true;
    const isWritable = true;

    return {
        absolute_path: absolutePath,
        is_readable: isReadable,
        is_writable: isWritable,
        size: stats.size,
        is_regular_file: stats.isFile(),
        is_directory: stats.isDirectory(),
        is_symbolic_link: stats.isSymbolicLink(),
        creation_millis: stats.birthtimeMs,
        last_modified_millis: stats.mtimeMs,
        last_access_millis: stats.atimeMs,
        sha256_digest: calcDigest ? await getFileHashDigest(filePath) : ""
    };
}

/**
 * Generates a SHA-256 hash digest of a file at the given path.
 * @param filePath Path to the target file.
 * @returns A promise that resolves to the hex string hash.
 */
async function getFileHashDigest(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);

        stream.on('data', (chunk) => {
            hash.update(chunk);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex'));
        });

        stream.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Validates that the given file/directory path physically exists on disk.
 * @param path The absolute/relative path to validate.
 * @param name The name of the parameter (used in exception message).
 * @return true If the target path exists
 */
export async function isFileExists(path: string, name: string): Promise<boolean> {
    requireNonBlank(path, name);
    try {
        // F_OK checks if the file is visible
        await access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * Extracts the file extension from a filename.
 * @param filename The name of the file.
 * @returns The file extension without the leading dot.
 * @throws {Error} If the filename is blank or has no extension.
 */
export function getFileExtension(filename: string): string {
    check.requireNonBlank(filename, 'filename');
    const extension = extname(filename);
    if (extension) {
        return extension.substring(1);
    }
    throw new Error(`Cannot get the extension of the file: ${filename}`);
}

/**
 * Create text file with given content, strict empty parameter guard.
 * @param filePath Target absolute/relative file path string
 * @param content Initial text content to write into new file
 * @param charset Text file decode encoding
 * @throws Error If file_path is empty string or whitespace only
 */
export async function create_file(
    filePath: string,
    content: string = "",
    charset: string = "utf-8"
): Promise<void> {
    await check.requireWritableParentDirectory(filePath, "filePath");

    await mkdir(filePath.split("/").slice(0, -1).join("/"), {recursive: true});
    // target.write_text(content, encoding=charset)
    await writeFile(filePath, content, {encoding: check.toBufferEncoding(charset)});
}

/**
 * Permanently delete a single regular file from filesystem.
 * Does NOT support directory removal.
 * Validation chain: blank path → file exists & readable → parent directory writable.
 * File deletion permission is controlled by parent directory write access, not file itself.
 * @param filePath Absolute or relative path of target file to delete
 * @returns Resolve void after file removed
 * @throws Error If blank path, file missing, target is directory, or parent lacks write permission
 */
export async function deleteFile(filePath: string): Promise<void> {
    check.requireNonBlank(filePath, 'filePath');
    await check.requireReadableFile(filePath, 'filePath');
    // Verify parent folder has write permission to allow deletion
    await check.requireWritableParentDirectory(filePath, 'filePath');

    await unlink(filePath);
}

/**
 * Copies a file from a source path to a destination path.
 * @param sourceFilePath The path to the source file.
 * @param destFilePath The path to the destination file.
 * @param overwrite If true, overwrites the destination file if it exists.
 * @returns A promise that resolves when the copy operation is complete.
 */
export async function copyFile(
    sourceFilePath: string,
    destFilePath: string,
    overwrite: boolean
): Promise<void> {
    check.requireNonBlank(sourceFilePath, 'sourceFilePath');
    await check.requireReadableFile(sourceFilePath, 'sourceFilePath');
    check.requireNonBlank(destFilePath, 'destFilePath');
    await check.requireWritableParentDirectory(destFilePath, 'destFilePath');

    await cp(sourceFilePath, destFilePath, {force: overwrite});
}

/**
 * Moves a file from a source path to a destination path.
 * @param sourceFilePath The path to the source file.
 * @param destFilePath The path to the destination file.
 * @param overwrite If true, overwrites the destination file if it exists.
 * @returns A promise that resolves when the move operation is complete.
 */
export async function moveFile(
    sourceFilePath: string,
    destFilePath: string,
    overwrite: boolean
): Promise<void> {
    check.requireNonBlank(sourceFilePath, 'sourceFilePath');
    await check.requireReadableFile(sourceFilePath, 'sourceFilePath');
    check.requireNonBlank(destFilePath, 'destFilePath');
    await check.requireWritableParentDirectory(destFilePath, 'destFilePath');

    await cp(sourceFilePath, destFilePath, {force: overwrite});
    await unlink(sourceFilePath);
}