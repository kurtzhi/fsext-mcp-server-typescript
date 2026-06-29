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
 * Service for performing search and replace operations on text files.
 * Uses temporary file + atomic replace to avoid original file corruption during rewrite.
 */

import {createReadStream, createWriteStream} from 'fs';
import {rename, unlink} from 'fs/promises';
import {join, dirname} from 'path';
import {createInterface} from 'readline';

import * as check from './check.utils.js';
import * as file from './file.js';


/**
 * Atomic safe search & replace for text file using temporary intermediate file.
 * Avoids corrupting original file on crash by writing all changes to temp file first,
 * then atomically swapping to original path. Cross-device rename fallback supported.
 * @param filePath Target editable text file path.
 * @param searchTerm Plain text substring to match globally.
 * @param replacement Replacement string for matched substrings.
 * @param lineSeparator Line break used to reconstruct output lines, default newline.
 * @returns Total count of lines where at least one replacement occurred.
 * @throws {Error} On file read/write/rename permission or IO failures.
 */
export async function fileReplace(
    filePath: string,
    searchTerm: string,
    replacement: string,
    lineSeparator: string = '\n'
): Promise<number> {
    await check.requireWritableFile(filePath, 'filePath');

    const tempFilePath = join(dirname(filePath), `replace_${Date.now()}.tmp`);
    let replaceCount = 0;

    const reader = createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity
    });

    const writer = createWriteStream(tempFilePath);

    return new Promise((resolve, reject) => {
        writer.on('finish', async () => {
            try {
                await rename(tempFilePath, filePath);
                resolve(replaceCount);
            } catch (err) {
                // Cross-device or permission rename failure fallback
                if (isNodeError(err) && (
                    err.code === 'EXDEV' || err.code === 'EPERM'
                )) {
                    try {
                        await file.copyFile(tempFilePath, filePath, true);
                        await unlink(tempFilePath);
                    } catch (fallbackErr) {
                        reject(fallbackErr);
                        return; // Stop execution after reject
                    }
                } else {
                    reject(err);
                    return;
                }
            }

            resolve(replaceCount);
        });

        writer.on('error', async (err) => {
            // Clean up orphan temp file on write failure
            try {
                await unlink(tempFilePath);
            } catch (cleanupErr) {
                console.error(`Failed to cleanup temp file: ${cleanupErr}`);
            }
            reject(err);
        });

        reader.on('line', (line) => {
            const newLine = line.replace(new RegExp(searchTerm, 'g'), replacement);
            if (newLine !== line) {
                replaceCount++;
            }
            writer.write(newLine + lineSeparator);
        });

        reader.on('close', () => {
            writer.end();
        });

        reader.on('error', (err) => {
            writer.end();
            reject(err);
        });
    });
}

/**
 * Type guard to narrow unknown error into Node system ErrnoException.
 * @param error Raw caught error value
 * @returns True if error object contains OS error code property
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}