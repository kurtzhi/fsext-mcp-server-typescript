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


import {tmpdir} from 'os';
import {dirname, resolve} from 'path';
import {mkdtemp, rm, mkdir} from 'fs/promises';

import {
    listDirectory, copyDirectory, moveDirectory,
    readTextFile, readTextFileRange, readBinaryFile, writeTextFile, writeBinaryFile,
    getFileInfo, copyFile, moveFile,
    searchFilesByContent, searchInFilesByContent, searchInFileByContent,
    fileReplace,
    rotateImage, resize, crop,
    extractText, cleanOcrText
} from '../src/index.js';


// ==================== Configuration Constants ====================
const TESSDATA_DIR = "D:/Programs/tessdata_best-4.1.0";
const TESSERACT_BIN_PATH = "C:/Program Files/Tesseract-OCR/tesseract.exe";
const CLEAN_TEMP_WORKSPACE = true;

const COPY_SUFFIX = ".bak";
const MOVE_SUFFIX = ".00";

// File paths for file operations
//const FILE_OPER_DIR = MOVE_DEST_DIR;
const SOURCE_FILE_PATH = "/service/file_read.ts";

// File paths for binary operations
const SOURCE_BINARY_PATH = "/img/cochem_castle.jpg";

// Batch processing parameters
const TEXT_BATCH_SIZE = 10;
const BINARY_BATCH_SIZE = 40960;

// Search and replace parameters
const SEARCH_KEYWORD = "export async function";
const REGEX_PATTERN = "export\\\s+async\\\s+function\\\s+readTextFile";
const REPLACE_TARGET = "lineSeparator";
const REPLACE_REPLACEMENT = "lineDelimiter";

// Image processing paths and parameters
const SOURCE_IMAGE_PATH = "/img/cochem_castle.jpg";
const IMG_OUTPUT_EXT = ".gif"
const ROTATE_DEGREES = 45.0;
const RESIZE_WIDTH = 1200;
const RESIZE_HEIGHT = 900;
const CROP_X = 800;
const CROP_Y = 150;
const CROP_WIDTH = 2400;
const CROP_HEIGHT = 2350;

// OCR parameters
const OCR_EN_IMAGE_PATH = "/img/github_en.png";
const OCR_CH_IMAGE_PATH = "/img/bing_zh.png";
const LANG_ENG = "eng";
const LANG_CHI_SIM = "chi_sim";

let TmpRoot: string;
let TmpSrcDst: string;
let TmpTestsDst: string;
let ReplaceSrcFile: string;

async function init() {
    TmpRoot = await mkdtemp(resolve(tmpdir(), "fsext_test_temp"));
}

function teardown() {
    if (CLEAN_TEMP_WORKSPACE) {
        if (TmpRoot) rm(TmpRoot, {recursive: true, force: true});
    } else {
        if (TmpRoot) console.log("Temp workspace path: " + TmpRoot);
    }
}


// ==================== Helper Functions ====================
function printSeparator() {
    console.log("----------------------------------------------------------------------");
}

// ==================== Main Execution ====================
async function runTests() {
    try {
        await init();
        console.log("--- Testing Directory Listing and Management ---");
        await testDirectoryListing();
        console.log("Directory tests passed.\n");

        console.log("--- Testing File Operations ---");
        await testFileOperations();
        console.log("File operations tests passed.\n");

        console.log("--- Testing Text Read/Write ---");
        await testTextReadWrite();
        console.log("Text read/write tests passed.\n");

        console.log("--- Testing Text Batch Processing ---");
        await testTextBatchProcessing();
        console.log("Text batch processing completed.\n");

        console.log("--- Testing Binary Batch Processing ---");
        await testBinaryBatchProcessing();
        console.log("Binary batch processing completed.\n");

        printSeparator();
        console.log("--- Testing Content Search ---");
        await testContentSearch();
        console.log("Content search tests passed.\n");

        printSeparator();
        console.log("--- Testing Regex Search ---");
        await testRegexSearch();
        console.log("Regex search tests passed.\n");

        printSeparator();
        console.log("--- Testing Search and Replace ---");
        await testSearchAndReplace();
        console.log("Search and replace operations completed.\n");

        console.log("--- Testing Image Processing ---");
        await testImageProcessing();
        console.log("Image processing (rotate, resize, crop) completed.\n");

        console.log("--- Testing OCR ---");
        await testOcr();
        console.log("OCR tests passed.\n");

    } catch (error) {
        console.error("Test failed:", error);
        process.exit(1);
    } finally {
        teardown();
    }
}

// ==================== Test Implementations ====================

async function testDirectoryListing() {

    let projRoot = process.cwd().toString();
    projRoot = projRoot;

    // 1. Copy & Move src Directory
    let srcDir = projRoot + "/src";
    let dstDir = TmpRoot + "/src" + COPY_SUFFIX;
    await copyDirectory(srcDir, dstDir, true);
    TmpSrcDst = dstDir;
    srcDir = dstDir;
    dstDir = TmpRoot + "/src" + MOVE_SUFFIX;
    await moveDirectory(srcDir, dstDir, true);
    TmpSrcDst = dstDir;

    // 2. Copy & Move tests Directory
    srcDir = projRoot + "/tests";
    dstDir = TmpRoot + "/tests" + COPY_SUFFIX;
    await copyDirectory(srcDir, dstDir, true);
    TmpTestsDst = dstDir;
    srcDir = dstDir;
    dstDir = TmpRoot + "/tests" + MOVE_SUFFIX;
    await moveDirectory(srcDir, dstDir, true);
    TmpTestsDst = dstDir;

    // 3. List Directory
    const filePaths = await listDirectory(TmpRoot, true, false, ".ts");
    console.log(`Total .ts files listed: ${filePaths.length}`);
}

async function testFileOperations() {
    // 1. Get File Info
    let srcFile = TmpSrcDst + SOURCE_FILE_PATH;
    const fileInfo = await getFileInfo(srcFile, false);

    let filename = SOURCE_FILE_PATH.substring(SOURCE_FILE_PATH.lastIndexOf('/'))
    // 2. Copy File
    let copyToFile = TmpRoot + filename + COPY_SUFFIX;
    await copyFile(srcFile, copyToFile, true);

    // 3. Move File
    let moveSrcFile = copyToFile;
    let moveToFile = TmpRoot + filename + MOVE_SUFFIX;
    await moveFile(moveSrcFile, moveToFile, true);
}

async function testTextReadWrite() {
    // 1. Read Text
    const content = await readTextFile(TmpSrcDst + SOURCE_FILE_PATH);
    console.log(`Read text content length: ${content.length}`);

    // 2. Write Text
    let filename = SOURCE_FILE_PATH.substring(SOURCE_FILE_PATH.lastIndexOf('/') + 1);
    await writeTextFile(TmpRoot + '/' + filename + '.wt1', content);
}

async function testTextBatchProcessing() {
    let skippedLines = 0;
    let totalLines = 0;

    let src = TmpSrcDst + SOURCE_FILE_PATH;
    let filename = SOURCE_FILE_PATH.substring(SOURCE_FILE_PATH.lastIndexOf('/') + 1);
    let dst = TmpRoot + '/' + filename + '.wt2';
    while (true) {
        const result = await readTextFileRange(src, skippedLines, TEXT_BATCH_SIZE);

        if (result.lines_count > 0) {
            await writeTextFile(dst, result.content, skippedLines > 0);
            totalLines += result.lines_count;
        }

        if (result.lines_count < TEXT_BATCH_SIZE) {
            break;
        }
        skippedLines += result.lines_count;
    }
    console.log(`Text batch processing completed. Total lines processed: ${totalLines}`);
}

async function testBinaryBatchProcessing() {
    let offset = 0;
    let totalBytes = 0;
    const buffer = Buffer.alloc(BINARY_BATCH_SIZE);

    let src = TmpTestsDst + SOURCE_BINARY_PATH;
    let filename = SOURCE_BINARY_PATH.substring(SOURCE_BINARY_PATH.lastIndexOf('/') + 1);
    let dst = TmpRoot + '/' + filename + '.txt';
    while (true) {
        const result = await readBinaryFile(src, buffer, offset, BINARY_BATCH_SIZE);

        if (result.actual_length > 0) {
            const writeBuf = result.bytes.slice(0, result.actual_length);
            await writeBinaryFile(dst, writeBuf, 0, result.actual_length, offset > 0);
            totalBytes += result.actual_length;
        }

        if (result.end_of_stream) {
            break;
        }
        offset += result.actual_length;
    }
    ReplaceSrcFile = dst;
    console.log(`Binary batch processing completed. Total bytes processed: ${totalBytes}`);
}

async function testContentSearch() {
    // 1. Search files by regex expression
    const rFileResults = await searchFilesByContent(
        TmpRoot, true, REGEX_PATTERN, true, true, ".ts"
    );
    console.log(`[Files matched(via regex match test)]: ${rFileResults.length}`);
    for (const filePath of rFileResults) {
        try {
            const results = await searchInFileByContent(
                filePath, SEARCH_KEYWORD, false, true, 0, 0
            );
            results.forEach(res => {
                console.log(`${res.file_path}: Lines ${res.start_line} - ${res.end_line}\n\t${res.text}`);
            });
        } catch (e) {
            console.error(`Failed to search files by regex expression: ${filePath}`, e);
        }
    }

    // Search Files by text content
    const fileResults = await searchFilesByContent(
        TmpRoot, true, SEARCH_KEYWORD, false, true, "");

    console.log(`\n[Files matched]: ${fileResults.length}`);

    for (const filePath of fileResults) {
        try {
            const results = await searchInFileByContent(
                filePath, SEARCH_KEYWORD, false, true, 0, 0
            );
            results.forEach(res => {
                console.log(`${res.file_path}: Lines ${res.start_line} - ${res.end_line}\n\t${res.text}`);
            });
        } catch (e) {
            console.error(`Failed to search in file by text content: ${filePath}`, e);
        }
    }
}

async function testRegexSearch() {
    // Search for lines matching regex
    const searchResults = await searchInFilesByContent(
        TmpRoot, true, REGEX_PATTERN, 100,
        true, true, 0, 0, ".ts"
    );

    console.log(`\n[Content matches]: ${searchResults.length}`);
    for (const res of searchResults) {
        console.log(`${res.file_path}: Lines ${res.start_line} - ${res.end_line}`);
    }
}

async function testSearchAndReplace() {
    await fileReplace(ReplaceSrcFile, REPLACE_TARGET, REPLACE_REPLACEMENT, "\n");
    console.log("Search and replace operations completed.");
}

async function testImageProcessing() {
    let srcImg = TmpTestsDst + SOURCE_IMAGE_PATH;
    let filename = SOURCE_IMAGE_PATH.substring(SOURCE_IMAGE_PATH.lastIndexOf('/'));
    let dstImg = TmpRoot + filename;
    // 1. Rotate
    await rotateImage(srcImg, dstImg + ".rotated" + IMG_OUTPUT_EXT, ROTATE_DEGREES);

    // 2. Resize
    await resize(srcImg, dstImg + ".resized" +
                         IMG_OUTPUT_EXT, RESIZE_WIDTH, RESIZE_HEIGHT, true);

    // 3. Crop
    await crop(srcImg, dstImg + ".cropped" +
                       IMG_OUTPUT_EXT, CROP_X, CROP_Y, CROP_WIDTH, CROP_HEIGHT);
}

async function testOcr() {
    // 1. English OCR
    let ocrImgEn = TmpTestsDst + OCR_EN_IMAGE_PATH;
    const enText = await extractText(ocrImgEn, TESSERACT_BIN_PATH, LANG_ENG, TESSDATA_DIR);
    console.log("OCR English text result:", cleanOcrText(enText));

    // 2. Chinese OCR
    let ocrImgCh = TmpTestsDst + OCR_CH_IMAGE_PATH;
    const chText = await extractText(ocrImgCh, TESSERACT_BIN_PATH, LANG_CHI_SIM, TESSDATA_DIR);
    console.log("OCR Chinese text result:", cleanOcrText(chText));
}

// Start test
runTests();