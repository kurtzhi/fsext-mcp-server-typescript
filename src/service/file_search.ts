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
 * File content search service, provides directory and single file grep with context lines.
 * All path arguments are validated via unified check_utils utilities.
 */

import {createReadStream} from 'fs';
import {createInterface} from 'readline';
import {resolve} from 'path';

import {listDirectory} from './dir.js';
import * as check from './check.utils.js';


export interface FileSearchResult {
    file_path: string;
    start_line: number;
    end_line: number;
    text: string;
}

/**
 * Scan directory files and return simple file path list where content matches search term.
 * Stop reading single file immediately after first match to save IO cost.
 * @param dirPath Root directory to scan.
 * @param recursive Enable deep subdirectory traversal.
 * @param searchTerm Raw text or regex source string.
 * @param isRegex Treat searchTerm as regular expression pattern if true.
 * @param ignoreCase Case-insensitive matching flag, enabled by default.
 * @param fileExtension Optional suffix filter for target files.
 * @param charset Text file decode encoding, default utf8.
 * @returns Array of absolute file paths with at least one matched line.
 */
export async function searchFilesByContent(
    dirPath: string,
    recursive: boolean,
    searchTerm: string,
    isRegex: boolean = false,
    ignoreCase: boolean = true,
    fileExtension: string,
    charset: string = 'utf8'
): Promise<string[]> {
    check.requireNonBlank(dirPath, 'dirPath');
    await check.requireReadableDirectory(dirPath, 'dirPath');
    await check.requireNonBlank(searchTerm, 'searchTerm');

    const files = await listDirectory(dirPath, recursive, true, fileExtension);
    const matchedFiles: string[] = [];
    const query = ignoreCase ? searchTerm.toLowerCase() : searchTerm;
    const regex = isRegex ? new RegExp(query, ignoreCase ? 'i' : '') : null;

    for (const file of files) {
        const rl = createInterface({
            input: createReadStream(
                file,
                {
                    encoding: check.toBufferEncoding(
                        charset)
                }
            ),
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            const processedLine = ignoreCase ? line.toLowerCase() : line;
            if (regex ? regex.test(processedLine) : processedLine.includes(query)) {
                matchedFiles.push(file);
                rl.close();
                break;
            }
        }
    }
    return matchedFiles;
}

/**
 * Recursively scan directory and return full context match entries with surrounding lines.
 * Stop scanning early once total result count reaches limit.
 * @param dirPath Root scan directory path.
 * @param recursive Traverse subfolders recursively when true.
 * @param searchTerm Raw search text or regex source.
 * @param limit Max total match entries allowed in final result.
 * @param isRegex Enable regular expression matching mode.
 * @param ignoreCase Ignore character case during matching.
 * @param linesBefore Number of preceding lines to attach as context before matched line.
 * @param linesAfter Number of trailing lines to attach as context after matched line.
 * @param fileExtension Optional file suffix filter.
 * @param charset Text file read encoding, default utf8.
 * @returns Structured match list with file path, line range and full context text.
 */
export async function searchInFilesByContent(
    dirPath: string,
    recursive: boolean,
    searchTerm: string,
    limit: number,
    isRegex: boolean,
    ignoreCase: boolean,
    linesBefore: number,
    linesAfter: number,
    fileExtension: string,
    charset: string = 'utf8'
): Promise<FileSearchResult[]> {
    await check.requireReadableDirectory(dirPath, 'dirPath');
    check.requireNonBlank(searchTerm, 'searchTerm');

    const files = await listDirectory(dirPath, recursive, true, fileExtension);
    const results: FileSearchResult[] = [];
    const pattern = isRegex ? new RegExp(searchTerm, ignoreCase ? 'i' : '') : null;
    const safeLinesBefore = Math.max(0, linesBefore);
    const safeLinesAfter = Math.max(0, linesAfter);

    for (const file of files) {
        if (results.length >= limit) break;
        await grepFile(
            file,
            results,
            searchTerm,
            pattern,
            ignoreCase,
            safeLinesBefore,
            safeLinesAfter,
            limit,
            charset
        );
    }

    return results;
}

/**
 * Scan single text file and collect full context match entries.
 * @param filePath Target readable text file absolute/relative path.
 * @param searchTerm Raw search text or regex source string.
 * @param isRegex Use regex matching mode if true.
 * @param ignoreCase Disable case-sensitive matching.
 * @param linesBefore Context line count before matched line.
 * @param linesAfter Context line count after matched line.
 * @param charset File text decode encoding.
 * @returns All structured match context entries found inside this file.
 */
export async function searchInFileByContent(
    filePath: string,
    searchTerm: string,
    isRegex: boolean,
    ignoreCase: boolean,
    linesBefore: number,
    linesAfter: number,
    charset: string = 'utf8'
): Promise<FileSearchResult[]> {
    await check.requireReadableFile(filePath, 'filePath');
    check.requireNonBlank(searchTerm, 'searchTerm');

    const results: FileSearchResult[] = [];
    const pattern = isRegex ? new RegExp(searchTerm, ignoreCase ? 'i' : '') : null;
    const safeLinesBefore = Math.max(0, linesBefore);
    const safeLinesAfter = Math.max(0, linesAfter);

    await grepFile(filePath, results, searchTerm, pattern, ignoreCase,
        safeLinesBefore, safeLinesAfter, check.MAX_INT, charset
    );

    return results;
}

/**
 * Internal core stream grep implementation with sliding context window logic.
 * Mutates shared results array directly, stop processing early when hitting global result limit.
 * @param filePath Target file path to scan line-by-line.
 * @param results Shared output accumulator for all matched context blocks.
 * @param searchTerm Raw original search string.
 * @param pattern Precompiled regex object or null for plain substring match.
 * @param ignoreCase Case-insensitive match toggle.
 * @param linesBefore Max preceding context lines stored in sliding window.
 * @param linesAfter Max trailing context lines captured after hit line.
 * @param limit Hard cap for total allowed match entries across all files.
 * @param charset Stream text encoding.
 */
async function grepFile(
    filePath: string,
    results: FileSearchResult[],
    searchTerm: string,
    pattern: RegExp | null,
    ignoreCase: boolean,
    linesBefore: number,
    linesAfter: number,
    limit: number,
    charset: string
): Promise<void> {
    const rl = createInterface({
        input: createReadStream(
            filePath,
            {encoding: check.toBufferEncoding(charset)}
        ),
        crlfDelay: Infinity
    });

    const query = ignoreCase ? searchTerm.toLowerCase() : searchTerm;
    const lineStack: string[] = [];
    let searchHit = false;
    let countAfter = 0;
    let lineNo = 0;

    for await (const rawLine of rl) {
        if (results.length >= limit) {
            break;
        }

        lineNo++;
        // Uniformly strip \r\n to keep line content consistent with Java/Python implementations
        const line = rawLine.replace(/[\r\n]$/, '');
        const isMatch = isLineMatch(line, query, pattern, ignoreCase);

        if (isMatch) {
            // Match found: add line to stack, mark hit state, reset after counter
            lineStack.push(line);
            searchHit = true;
            countAfter = 0;
        } else if (searchHit) {
            // In post-match phase to collect trailing context lines

            // When linesAfter is 0 and linesBefore larger than 0, current line shouldn't be dropped
            if (countAfter === linesAfter || countAfter + 1 === linesAfter) {
                let lNo: number;
                let lineFed = false;
                if (countAfter === linesAfter) {
                    // Do not append current line to result (trailing context lines full)
                    lNo = lineNo - 1;
                } else {
                    lineStack.push(line);
                    lineFed = true;
                    lNo = lineNo;
                }

                const startLine = lNo - lineStack.length + 1;
                results.push({
                    file_path: resolve(filePath),
                    start_line: startLine,
                    end_line: lNo,
                    text: lineStack.join('\n'),
                });

                // Reset match state
                searchHit = false;
                countAfter = 0;
                lineStack.length = 0;

                // Rule: If current line is not added to this context block and preceding context
                // lines are required, push to sliding window Stack is empty after clear, only push
                // without judging stack overflow
                if (!lineFed && linesBefore > 0) {
                    lineStack.push(line);
                }
            } else {
                lineStack.push(line);
                countAfter++;
            }
        } else {
            lineStack.push(line);
            if (linesBefore === 0) {
                lineStack.length = 0;
            } else if (lineStack.length > linesBefore) {
                lineStack.shift();
            }
        }
    }

    // Flush remaining context lines if still in match state when file stream ends
    if (searchHit && lineStack.length > 0) {
        const startLine = lineNo - lineStack.length + 1;
        results.push({
            file_path: resolve(filePath),
            start_line: startLine,
            end_line: lineNo,
            text: lineStack.join('\n'),
        });
    }
}

/**
 * Substring matching logic, aligned with Java Matcher.find() behavior
 */
function isLineMatch(
    line: string,
    query: string,
    pattern: RegExp | null,
    lowerCased: boolean
): boolean {
    if (pattern) {
        return pattern.test(line);
    }
    if (lowerCased) {
        return line.toLowerCase().includes(query);
    }
    return line.includes(query);
}