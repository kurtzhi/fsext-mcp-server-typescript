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
 * Service for writing text and binary content to files with safety permission validation.
 */

import {writeFile, appendFile, createWriteStream} from 'fs';
import {promisify} from 'util';

import * as check from './check.utils.js';
import {isFileExists} from "./file.js";

type FsTextWrite = (
    path: string,
    data: string,
    opts: { encoding: BufferEncoding }
) => Promise<void>;


const appendFileAsync = promisify(appendFile) as unknown as FsTextWrite;
const writeFileAsync = promisify(writeFile) as unknown as FsTextWrite;


/**
 * Write text content to target file, support overwrite or append mode.
 * Append mode: Create file automatically if it does not exist; only verify writable permission.
 * Overwrite mode: Verify parent directory writable, create or truncate target file.
 * Invalid encoding string will be auto converted to utf8.
 * @param filePath The path to the target file.
 * @param text The string content to write.
 * @param append If true, appends the text; otherwise, overwrites the file.
 * @param charset Raw encoding string, auto converted to valid BufferEncoding.
 * @returns A promise that resolves when the write operation is complete.
 */
export async function writeTextFile(
    filePath: string,
    text: string,
    append: boolean = false,
    charset: string = "utf8"
): Promise<void> {
    check.requireNonBlank(filePath, "filePath");

    if (await isFileExists(filePath, "filePath")) {
        await check.requireWritableFile(filePath, 'filePath');
    } else {
        await check.requireWritableParentDirectory(filePath, 'filePath');
    }

    const encoding = check.toBufferEncoding(charset);
    const fsOpts = {encoding};
    if (append) {
        await appendFileAsync(filePath, text, fsOpts);
    } else {
        await writeFileAsync(filePath, text, fsOpts);
    }
}

/**
 * Write partial slice of Buffer to file stream, support overwrite or append flag.
 * Validate buffer offset & length range before opening stream.
 * @param filePath The path to the target file.
 * @param data The byte array containing the data to write.
 * @param offset The start offset in the byte array.
 * @param len The number of bytes to write.
 * @param append If true, appends the bytes; otherwise, overwrites the file.
 * @returns A promise that resolves when the write operation is complete.
 */
export function writeBinaryFile(
    filePath: string,
    data: Buffer,
    offset: number,
    len: number,
    append: boolean = false
): Promise<void> {
    check.requireNonBlank(filePath, 'filePath');

    if (!data || data.length == 0) {
        throw new Error('Invalid data or invalid length of the data');
    }

    if (offset < 0 || len < 0 || offset + len > data.length) {
        throw new Error('Invalid offset or length for data buffer');
    }

    return new Promise(async (resolve, reject) => {
        try {
            if (await isFileExists(filePath, "filePath")) {
                await check.requireWritableFile(filePath, 'filePath');
            } else {
                await check.requireWritableParentDirectory(filePath, 'filePath');
            }

            const stream = createWriteStream(filePath, {flags: append ? 'a' : 'w'});
            const bufferToWrite = data.slice(offset, offset + len);

            stream.on('finish', () => resolve());
            stream.on('error', reject);

            stream.end(bufferToWrite);
        } catch (err) {
            reject(err);
        }
    });
}