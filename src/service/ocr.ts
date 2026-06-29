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
 * Service for performing Optical Character Recognition (OCR) on images via Tesseract.
 * All file and directory path inputs are validated through unified check_utils utilities.
 */

import {spawn} from 'child_process';

import {createWorker, WorkerOptions} from 'tesseract.js';

import * as check from './check.utils.js';


/**
 * Run Tesseract OCR on target image and extract plain text content via tesseract.js WASM worker.
 * @param imagePath Path of source image file for recognition.
 * @param lang OCR language code, default english ("eng"), supports "chi_sim" etc.
 * @param tessdataPath Custom directory path for trained language data files.
 * @returns Full recognized plain text extracted from image.
 */
export async function extractText_wasm(
    imagePath: string,
    tessdataPath: string = '',
    lang: string = 'eng'
): Promise<string> {
    await check.requireReadableFile(imagePath, 'imagePath');
    if (!check.isBlank(tessdataPath)) {
        await check.requireReadableDirectory(tessdataPath, 'tessdataPath')
    }

    const workerOptions: Partial<WorkerOptions> = {
        ...(
            tessdataPath ? {langPath: tessdataPath, gzip: false} : {}
        ),
    };

    const worker = await createWorker(lang, 1, workerOptions);

    try {
        const {data: {text}} = await worker.recognize(imagePath);
        return text;
    } finally {
        await worker.terminate();
    }
}


/**
 * Extract text from local image by calling native tesseract binary (no WASM, no compatibility
 * crash). Depend on locally installed Tesseract-OCR program.
 * @param imagePath Absolute path of source image file
 * @param tesseractBinPath Full path of Tesseract executable binary
 * @param lang OCR language code like eng / chi_sim
 * @param tessdataPath Local tessdata traineddata directory path
 * @returns Pure recognized text string
 */
export async function extractText(
    imagePath: string,
    tesseractBinPath: string,
    lang: string = 'eng',
    tessdataPath: string = ''
): Promise<string> {
    check.requireNonBlank(imagePath, 'imagePath');
    await check.requireReadableFile(imagePath, 'imagePath');
    check.requireNonBlank(tesseractBinPath, 'tesseractBinPath');
    await check.requireReadableFile(tesseractBinPath, 'tesseractBinPath');

    if (tessdataPath && tessdataPath.trim() !== '') {
        check.requireNonBlank(tessdataPath, 'tessdataPath');
        await check.requireReadableDirectory(tessdataPath, 'tessdataPath');
    }

    return new Promise((resolve, reject) => {
        const args: string[] = [
            imagePath,
            'stdout',
            '-l', lang
        ];
        if (tessdataPath && tessdataPath.trim() !== '') {
            args.push('--tessdata-dir', tessdataPath);
        }

        const child = spawn(tesseractBinPath, args);
        let stdoutBuffer = '';
        let stderrBuffer = '';

        child.stdout.on('data', (chunk) => {
            stdoutBuffer += chunk.toString('utf8');
        });

        child.stderr.on('data', (chunk) => {
            stderrBuffer += chunk.toString('utf8');
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdoutBuffer);
            } else {
                reject(new Error(`Tesseract binary exit code:${code}, stderr: ${stderrBuffer}`));
            }
        });

        child.on('error', (err) => {
            reject(new Error(`Spawn tesseract failed: ${err.message}`));
        });
    });
}


/**
 * Optional OCR text cleaner for keyword search scenario
 * Only use when you don't need raw complete evidence text
 * Remove url fragments, messy single noise symbols, extra whitespace
 * @param raw Original full OCR text from extractText
 * @returns Clean text for keyword matching
 */
export function cleanOcrText(raw: string): string {
    return raw
        .replace(/https?:\/\/[\w\.\/:@#-]+/g, "")
        .replace(/[@#\[\]Wm]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}