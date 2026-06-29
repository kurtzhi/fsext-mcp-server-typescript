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
 * Utility class for performing various checks.
 * All validation functions raise ValueError when check condition fails.
 */

import {constants} from 'fs';
import {access, stat} from 'fs/promises';
import {dirname} from 'path';


export const MAX_INT: number = 2147483647;


/**
 * Tests if the given string is null, undefined, or whitespace-only blank.
 * @param str The string to validate.
 * @returns True if input is null/undefined/blank string, false otherwise
 */
export function isBlank(str: string | null | undefined): boolean {
    if (!str || str.trim() === '') {
        return true;
    }
    return false;
}

/**
 * Validates that the given string is not null, undefined, or blank whitespace.
 * @param str The string to validate.
 * @param name The name of the parameter (used in exception message).
 * @throws {Error} If the string is null, undefined or blank
 */
export function requireNonBlank(str: string | null | undefined, name: string): void {
    if (isBlank(str)) {
        throw new Error(`${name} cannot be empty or blank whitespace`);
    }
}

/**
 * Validates that the given file/directory path physically exists on disk.
 * @param path The absolute/relative path to validate.
 * @param name The name of the parameter (used in exception message).
 * @throws {Error} If the target path does not exist
 */
export async function requirePathExists(path: string, name: string): Promise<void> {
    requireNonBlank(path, name);
    try {
        await access(path, constants.F_OK);
    } catch {
        throw new Error(`Parameter ${name} does not exist at path: ${path}`);
    }
}

/**
 * Validates that the given path exists and points to a readable regular file.
 * @param path The absolute/relative file path to validate.
 * @param name The name of the parameter (used in exception message).
 * @throws {Error} If path missing, not a file, or read permission denied
 */
export async function requireReadableFile(path: string, name: string): Promise<void> {
    requireNonBlank(path, name);
    await requirePathExists(path, name);
    try {
        const stats = await stat(path);
        if (!stats.isFile()) {
            throw new Error(`Parameter ${name} is not a regular file: ${path}`);
        }
        await access(path, constants.R_OK);
    } catch (e: any) {
        throw new Error(`Parameter ${name} invalid: not readable or not a valid file at ${path} (root cause: ${e.message})`);
    }
}

/**
 * Validates that the given path exists and points to a writable regular file.
 * @param path The absolute/relative file path to validate.
 * @param name The name of the parameter (used in exception message).
 * @throws {Error} If path missing, not a file, or write permission denied
 */
export async function requireWritableFile(path: string, name: string): Promise<void> {
    requireNonBlank(path, name);
    await requirePathExists(path, name);
    try {
        const stats = await stat(path);
        if (!stats.isFile()) {
            throw new Error(`Parameter ${name} is not a regular file: ${path}`);
        }
        await access(path, constants.W_OK);
    } catch (e: any) {
        throw new Error(`Parameter ${name} invalid: unwritable or not a valid file at ${path} (root cause: ${e.message})`);
    }
}

/**
 * Validates that the given path exists and points to a readable directory.
 * @param path The absolute/relative directory path to validate.
 * @param name The name of the parameter (used in exception message).
 * @throws {Error} If path missing, not a directory, or read permission denied
 */
export async function requireReadableDirectory(path: string, name: string): Promise<void> {
    requireNonBlank(path, name);
    await requirePathExists(path, name);
    try {
        const stats = await stat(path);
        if (!stats.isDirectory()) {
            throw new Error(`Parameter ${name} is not a directory: ${path}`);
        }
        await access(path, constants.R_OK);
    } catch (e: any) {
        throw new Error(`Parameter ${name} invalid: unreadable or not a valid directory at ${path} (root cause: ${e.message})`);
    }
}

/**
 * Validates that the given path exists and points to a writable directory.
 * @param path The absolute/relative directory path to validate.
 * @param name The name of the parameter (used in exception message).
 * @throws {Error} If path missing, not a directory, or write permission denied
 */
export async function requireWritableDirectory(path: string, name: string): Promise<void> {
    requireNonBlank(path, name);
    await requirePathExists(path, name);
    try {
        const stats = await stat(path);
        if (!stats.isDirectory()) {
            throw new Error(`Parameter ${name} is not a directory: ${path}`);
        }
        await access(path, constants.W_OK);
    } catch (e: any) {
        throw new Error(`Parameter ${name} invalid: unwritable or not a valid directory at ${path} (root cause: ${e.message})`);
    }
}

/**
 * Resolve parent directory of input path and validate it has write permission.
 * Used before creating new files to guarantee parent dir can receive new entries.
 * @param path Target file path whose parent directory will be validated.
 * @param name The name of the input path parameter (used in exception message).
 * @throws {Error} If input path blank or parent directory missing write permission
 */
export async function requireWritableParentDirectory(path: string, name: string): Promise<void> {
    requireNonBlank(path, name);
    const parentDir = dirname(path);
    await requireWritableDirectory(parentDir, `parent directory of ${name}`);
}


/**
 * Convert arbitrary input string to standard Node.js BufferEncoding type safely.
 * Fallback to "utf8" automatically if input is not a valid built-in buffer encoding.
 * Only Node native BufferEncoding values are recognized; third-party encodings (gbk, iso-8859-1
 * etc.) will fall back.
 * @param raw Raw encoding string passed from tool input parameters
 * @returns Valid BufferEncoding literal, default "utf8" for unsupported input
 */
export function toBufferEncoding(raw: string): BufferEncoding {
    const allowed: BufferEncoding[] = [
        "ascii", "utf8", "utf-8", "utf16le", "ucs2", "ucs-2",
        "base64", "base64url", "latin1", "binary", "hex"
    ];
    const target = raw.trim();
    if (allowed.includes(target as BufferEncoding)) {
        return target as BufferEncoding;
    }
    return "utf8";
}