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
 * Utility methods for file reading, supports text line range and binary partial read.
 * All file path arguments are validated via unified check_utils utilities.
 */

import {createReadStream} from 'fs';
import {open, readFile} from 'fs/promises';
import {createInterface} from 'readline';

import * as check from './check.utils.js';


export interface ReadResultString {
    lines_count: number;
    content: string;
}

export interface ReadResultBytes {
    bytes: Buffer;
    actual_length: number;
    end_of_stream: boolean;
}


/**
 * Read entire text file into single string with specified encoding.
 * @param filePath Target readable text file path.
 * @param charset Text encoding for file decode, default utf8.
 * @returns Full file text content as string.
 */
export async function readTextFile(
    filePath: string,
    charset: string = 'utf8'
): Promise<string> {
    await check.requireReadableFile(filePath, 'filePath');
    return readFile(filePath, {encoding: check.toBufferEncoding(charset)});
}

/**
 * Stream text file line by line, skip leading lines and limit read line count.
 * Uses readline stream to avoid loading full large file into memory.
 * @param filePath Target readable text file path.
 * @param linesToSkip Number of leading lines to skip before collecting content.
 * @param maxLinesToRead Maximum lines to collect after skipped offset.
 * @param lineSeparator Join character for output multi-line string, default newline.
 * @param charset Stream text encoding, default utf8.
 * @returns Collected line count and concatenated text content.
 */
export async function readTextFileRange(
    filePath: string,
    linesToSkip: number,
    maxLinesToRead: number,
    lineSeparator: string = '\n',
    charset: string = 'utf8'
): Promise<ReadResultString> {
    await check.requireReadableFile(filePath, 'filePath');

    linesToSkip = Math.max(linesToSkip, 0)
    maxLinesToRead = maxLinesToRead > 0 ? maxLinesToRead : check.MAX_INT;

    const lines: string[] = [];
    let linesCount = 0;

    const rl = createInterface({
        input: createReadStream(
            filePath,
            {encoding: check.toBufferEncoding(charset)}
        ),
        crlfDelay: Infinity
    });

    let i = 0;
    for await (const line of rl) {
        if (i >= linesToSkip) {
            if (linesCount < maxLinesToRead) {
                lines.push(line);
                linesCount++;
            } else {
                rl.close();
                break;
            }
        }
        i++;
    }

    return {
        lines_count: linesCount,
        content: lines.join(lineSeparator)
    };
}

/**
 * Partial binary file read with offset skip and length limit, support external output buffer reuse.
 * Note: Uses seek for random access, does not support pipe/stdin/socket non-seekable streams.
 * @param filePath
 * @param buffer Reusable Buffer for storing read bytes; auto create new empty buffer if null
 * @param bytesToSkip
 * @param maxBytesToRead
 * @returns ReadResultBytes contains filled buffer, actual read byte count and EOF flag
 */
export async function readBinaryFile(
    filePath: string,
    buffer: Buffer | null = null,
    bytesToSkip: number = 0,
    maxBytesToRead: number = 0
): Promise<ReadResultBytes> {
    check.requireNonBlank(filePath, "file_path");
    const p = filePath;
    await check.requireReadableFile(p, "file_path");

    const givenBufferLen = buffer !== null ? buffer.length : 0
    if (buffer != null && (
        givenBufferLen == 0 || givenBufferLen < maxBytesToRead
    )) {
        throw new Error(`max_bytes_to_read must be > 0, and buffer length must be >= maxBytesToRead.  
        got max_bytes_to_read = ${maxBytesToRead}, buffer.length = ${givenBufferLen}`);
    }

    let statFh = await open(p);
    const statInfo = await statFh.stat();
    await statFh.close();
    const file_size = statInfo.size;

    const skip = Math.max(bytesToSkip, 0);
    maxBytesToRead = maxBytesToRead > 0 ? maxBytesToRead : givenBufferLen;

    if (skip >= file_size) {
        return {
            bytes: Buffer.alloc(0),
            actual_length: 0,
            end_of_stream: true
        };
    }

    let fh = await open(p, "r");
    try {
        const bytesToRead = maxBytesToRead > 0 ? maxBytesToRead : file_size - skip;
        const tmpBuf = Buffer.alloc(bytesToRead);
        const readRes = await fh.read(tmpBuf, 0, bytesToRead, skip);
        const data = tmpBuf.subarray(0, readRes.bytesRead);

        const actualLength = data.length;
        const endOfStream = (
                                skip + actualLength
                            ) >= file_size;

        if (buffer === null) {
            buffer = Buffer.alloc(actualLength);
        } else if (buffer.length < actualLength) {
            buffer = Buffer.alloc(actualLength);
        }
        data.copy(buffer, 0, 0, actualLength);

        return {
            bytes: buffer,
            actual_length: actualLength,
            end_of_stream: endOfStream
        };
    } finally {
        await fh.close();
    }
}