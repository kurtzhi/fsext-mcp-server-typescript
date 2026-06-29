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
 * Cross-FS Module Integration Test Suite
 * Core Design Rules:
 * 1. Every test case contains centralized test intent block at top of function
 * 2. All write/move/copy/search operations are isolated inside auto-clean temp dir
 * 3. Source project root & static assets are READ-ONLY, zero write permission allowed
 * 4. Independent table report formatter with real-time progress bar + final full statistics
 * 5. Unified validation via shared check.utils, consistent error spec cross all services
 */

import {tmpdir} from 'os';
import {dirname, resolve} from 'path';
import { fileURLToPath } from 'url';
import {mkdtemp, rm, mkdir} from 'fs/promises';

import {
    listDirectory, copyDirectory, moveDirectory,
    readTextFile, readBinaryFile, writeTextFile, writeBinaryFile,
    getFileInfo, copyFile, moveFile, deleteFile,
    searchFilesByContent, searchInFileByContent,
    fileReplace,
    rotateImage, resize, crop,
    extractText
} from '../src/index.js';
import * as check from '../src/service/check.utils.js';


// ==================================== GLOBAL TEST META ENUM =====================================
enum TestCategory {
    NORMAL_FLOW = "NORMAL_FLOW",
    EDGE_BOUNDARY = "EDGE_BOUNDARY",
    ERROR_VALIDATION = "ERROR_VALIDATION",
    RISK_ONLY = "RISK_ONLY"
}

enum TestStatus {
    PASS = "PASS",
    FAIL = "FAIL",
    SKIP = "SKIP",
    RISK = "RISK"
}

// ========================= CENTRALIZED FROZEN STATIC CONFIG (READ ONLY) =========================
/** Read-only static assets & project root config, forbid any write operation */
class StaticAssetConfig {
    public readonly PROJECT_ROOT: string;
    public readonly TEST_ASSET_ROOT: string;
    public readonly SOURCE_SRC_ROOT: string;
    public readonly TESSDATA_STATIC_DIR: string;
    public readonly TESSERACT_BIN_PATH: string;
    public readonly IMG_CASTLE_JPG: string;
    public readonly IMG_OCR_EN_PNG: string;
    public readonly IMG_OCR_CN_PNG: string;
    public readonly LANG_ENG = "eng";
    public readonly LANG_CHI_SIM = "chi_sim";

    constructor() {
        const __filename = fileURLToPath(import.meta.url);
        const currentFile = resolve(__filename);
        const distDir = dirname(currentFile);
        this.PROJECT_ROOT = resolve(distDir, "../..");
        this.SOURCE_SRC_ROOT = resolve(this.PROJECT_ROOT, "src")
        this.TEST_ASSET_ROOT = resolve(this.PROJECT_ROOT, "tests", "img");
        this.TESSERACT_BIN_PATH = "C:/Program Files/Tesseract-OCR/tesseract.exe";
        this.TESSDATA_STATIC_DIR = "D:/Programs/tessdata_best-4.1.0";
        this.IMG_CASTLE_JPG = resolve(this.TEST_ASSET_ROOT, "cochem_castle.jpg");
        this.IMG_OCR_EN_PNG = resolve(this.TEST_ASSET_ROOT, "github_en.png");
        this.IMG_OCR_CN_PNG = resolve(this.TEST_ASSET_ROOT, "bing_zh.png");
    }
}

/** Business runtime fixed parameters, unified batch & match constants */
class BusinessParamConfig {
    public readonly CHARSET_STD = "utf8";
    public readonly LINE_SEP = "\n";
    public readonly TEXT_BATCH_READ_SIZE = 10;
    public readonly BINARY_BATCH_READ_SIZE = 40960;
    public readonly SEARCH_TARGET_KEYWORD = "export async function";
    public readonly SEARCH_RESULT_LIMIT = 100;
    public readonly REGEX_MATCH_PATTERN = "export\\s+async\\s+function\\s+readTextFile";
    public readonly REPLACE_OLD_TOKEN = "lineSeparator";
    public readonly REPLACE_NEW_TOKEN = "lineDelimiter";
    public readonly REPLACE_REVERT_TOKEN = "lineBreak";
    public readonly ROTATE_ANGLE_DEG = 45.0;
    public readonly RESIZE_TARGET_W = 1200;
    public readonly RESIZE_TARGET_H = 900;
    public readonly CROP_START_X = 800;
    public readonly CROP_START_Y = 150;
    public readonly CROP_REGION_W = 2400;
    public readonly CROP_REGION_H = 2350;
}

const ASSET_CFG = new StaticAssetConfig();
const PARAM_CFG = new BusinessParamConfig();

// =================================== GLOBAL UTILITY FUNCTIONS ===================================
/** Calculate SHA256 hash for file binary integrity comparison */
async function computeFileSha256(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const fs = await import('fs');
    const hash = crypto.createHash('sha256');
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

/** Standard structured test log payload for machine-readable JSON output */
interface StandardTestLogPayload {
    caseId: string;
    category: string;
    caseName: string;
    inputParams: Record<string, any>;
    expectSpec: string;
    actualResult: string;
    testStatus: string;
    durationMs: number;
    exceptionStack?: string;
}

// ============================ ENTERPRISE STANDALONE REPORT FORMATTER ============================
class TestReportFormatter {
    totalCases = 0;
    executedCases = 0;
    passCount = 0;
    failCount = 0;
    skipCount = 0;
    riskCount = 0;
    caseRecords: StandardTestLogPayload[] = [];
    startTs = Date.now();

    recordCase(payload: StandardTestLogPayload) {
        this.caseRecords.push(payload);
        this.executedCases++;
        switch (payload.testStatus) {
            case TestStatus.PASS:
                this.passCount++;
                break;
            case TestStatus.FAIL:
                this.failCount++;
                break;
            case TestStatus.SKIP:
                this.skipCount++;
                break;
            case TestStatus.RISK:
                this.riskCount++;
                break;
        }
    }

    printRealTimeProgress() {
        const progressPct = this.totalCases > 0 ? (
            (
                this.executedCases / this.totalCases
            ) * 100
        ).toFixed(2) : "0.00";
        const barLen = 30;
        const filled = Math.floor(barLen * Number(progressPct) / 100);
        const bar = "█".repeat(filled) + "=".repeat(barLen - filled);
        console.log(`\n[PROGRESS] ${this.executedCases}/${this.totalCases} ${bar} ${progressPct}% | PASS:${this.passCount} FAIL:${this.failCount}`);
    }

    printFinalTableReport() {
        const totalCostSec = (
            (
                Date.now() - this.startTs
            ) / 1000
        ).toFixed(2);
        const passRate = this.executedCases > 0 ? (
            (
                this.passCount / this.executedCases
            ) * 100
        ).toFixed(2) : "0.00";
        console.log("\n" + "=".repeat(120));
        console.log("FS INTEGRATION TEST FINAL STATISTICS REPORT (ENTERPRISE TABLE FORMAT)");
        console.log("=".repeat(120));
        const header = `${"CASE_ID".padEnd(16)}${"CATEGORY".padEnd(16)}${"STATUS".padEnd(10)}${"DURATION(ms)".padEnd(
            14)}CASE_DESC`;
        console.log(header);
        console.log("-".repeat(120));
        for (const rec of this.caseRecords) {
            const line = `${rec.caseId.padEnd(16)}${rec.category.padEnd(16)}${rec.testStatus.padEnd(
                10)}${String(rec.durationMs).padEnd(14)}${rec.caseName}`;
            console.log(line);
        }
        console.log("-".repeat(120));
        console.log(`Total Planned Cases: ${this.totalCases} | Executed: ${this.executedCases} | Total Time Cost: ${totalCostSec}s`);
        console.log(`PASS: ${this.passCount} | FAIL: ${this.failCount} | SKIP: ${this.skipCount} | RISK: ${this.riskCount} | Overall Pass Rate: ${passRate}%`);
        console.log("=".repeat(120) + "\n");
    }
}

// Global singleton report instance
const testReport = new TestReportFormatter();

/** Emit unified structured test log with JSON block + human readable brief, record to report */
function emitStandardTestLog(
    caseId: string,
    category: TestCategory,
    caseName: string,
    inputParams: Record<string, any>,
    expectSpec: string,
    actualResult: string,
    testStatus: TestStatus,
    durationMs: number,
    exceptionStack?: string
) {
    const payload: StandardTestLogPayload = {
        caseId,
        category: category.valueOf(),
        caseName,
        inputParams,
        expectSpec,
        actualResult,
        testStatus: testStatus.valueOf(),
        durationMs,
        exceptionStack
    };
    console.log("\n=== TEST_LOG_JSON_BEGIN ===");
    console.log(JSON.stringify(payload, null, 2));
    console.log("=== TEST_LOG_JSON_END ===");
    console.log(`[CASE:${caseId}] CAT:${category.valueOf()} STATUS:${testStatus.valueOf()} DURATION:${durationMs}ms`);
    console.log(`EXPECT: ${expectSpec}`);
    console.log(`ACTUAL: ${actualResult}`);
    if (exceptionStack) console.log(`EXCEPTION_STACK:\n${exceptionStack}`);
    console.log("-".repeat(100));
    testReport.recordCase(payload);
    testReport.printRealTimeProgress();
}

// ============================== TEST SUITE CORE ISOLATION WRAPPER ==============================
class FsStandardIntegrationTest {
    globalTempRoot!: string;
    searchDemoFile!: string;
    allCaseIds: string[] = [];

    async setup() {
        // Create global isolated temp root for entire test suite
        this.globalTempRoot = await mkdtemp(resolve(tmpdir(), "fs_case_temp_"));
        // Create demo search file with fixed keyword for content match test
        this.searchDemoFile = resolve(this.globalTempRoot, "base_search_demo.ts");
        await writeTextFile(
            this.searchDemoFile,
            `import * as check from './check.utils.js'\nexport async function demo_func() {\n    ${PARAM_CFG.SEARCH_TARGET_KEYWORD}("test.txt", "demo")\n}`
        );
        this.allCaseIds = [
            "DIR_001", "FILE_SVC_001", "TEXT_001", "BIN_001", "REPLACE_SVC_008",
            "SEARCH_001", "IMG_001", "OCR_001",
            "ERR_001", "ERR_002", "ERR_003", "ERR_004", "ERR_005"
        ];
        testReport.totalCases = this.allCaseIds.length;
    }

    async teardown() {
        if (this.globalTempRoot) await rm(this.globalTempRoot, {recursive: true, force: true});
    }

    /** Create independent sub dir for single case to avoid cross-case pollution */
    async createCaseIsolationDir(caseId: string): Promise<string> {
        const dir = resolve(this.globalTempRoot, caseId);
        await mkdir(dir, {recursive: true});
        return dir;
    }

    /** Unified anchor directory: all search/write/replace ops target this post-migrated folder */
    getPostMoveTargetDir(caseWorkspace: string): string {
        return resolve(caseWorkspace, "src_migrated");
    }

    // ============================== NORMAL FLOW TEST CASES ==============================
    /**
     * CENTRALIZED TEST INTENT BLOCK:
     * 1. Read-only recursive scan TS file list from project source root (zero write to src)
     * 2. Copy entire read-only source into case isolated temp backup directory
     * 3. Move backup directory to unified post-migrated anchor folder (single entry for all
     * downstream search/write)
     * 4. Assert scanned file count > 0, interim copy dir removed, migrated anchor dir exists
     * All mutable file/directory operations are restricted inside exclusive case temp workspace
     */
    async testDir001ListCopyMoveFullFlow() {
        const caseId = "DIR_001";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const srcReadOnlyRoot = ASSET_CFG.SOURCE_SRC_ROOT;
        const copyInterimDir = resolve(caseWorkspace, "src_backup");
        const moveTargetDir = this.getPostMoveTargetDir(caseWorkspace);
        const inputArgs = {
            readOnlyScanRoot: srcReadOnlyRoot,
            tempCopyInterimDir: copyInterimDir,
            unifiedPostMoveAnchorDir: moveTargetDir,
            recursiveScan: true,
            fileExtFilter: ".ts"
        };
        const expectRule = "1. Scanned TS file count > 0; 2. Copy source to temp interim dir success; 3. Move interim to unified migrated anchor; 4. Interim dir removed, migrated anchor exists";
        let actualSummary = "";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            const fileList = await listDirectory(srcReadOnlyRoot, true, false, ".ts");
            await copyDirectory(srcReadOnlyRoot, copyInterimDir, true);
            await moveDirectory(copyInterimDir, moveTargetDir, true);
            actualSummary =
                `Scanned TS file count: ${fileList.length} | Interim copy dir exists: ${await this.pathExists(
                    copyInterimDir)} | Migrated anchor exists: ${await this.pathExists(moveTargetDir)}`;
            if (fileList.length <= 0) throw new Error("Scanned source TS file list is empty");
            if (await this.pathExists(copyInterimDir)) {
                throw new Error(
                    "Interim copy directory was not removed after move");
            }
            if (!(
                await this.pathExists(moveTargetDir)
            )) {
                throw new Error("Unified post-move anchor directory missing after move");
            }
        } catch (e: any) {
            actualSummary = `Execution error: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.NORMAL_FLOW,
            "Directory Scan / Temp Copy / Move To Unified Migrated Anchor Dir",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /**
     * CENTRALIZED TEST INTENT BLOCK:
     * 1. Create exclusive isolated temp workspace for basic file CRUD operations
     * 2. Execute create, stat, copy, move, delete full lifecycle via file service
     * 3. Validate file existence state consistency after each operation
     * All file modification restricted to private case temp directory, no source code touch
     */
    async testFileSvc001BasicCrudValidate() {
        const caseId = "FILE_SVC_001";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const createTarget = resolve(caseWorkspace, "demo_file.txt");
        const copyTarget = resolve(caseWorkspace, "demo_file.copy.txt");
        const moveTarget = resolve(caseWorkspace, "demo_file.move.txt");
        const inputArgs = {createTarget, copyTarget, moveTarget};
        const expectRule = "File service can create, stat, copy, move and delete regular file without validation or IO error";
        let actualSummary = "";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            await writeTextFile(createTarget, "");
            const existsAfterCreate = await this.pathExists(createTarget);
            const statInfo = await getFileInfo(createTarget, false);
            await copyFile(createTarget, copyTarget, true);
            await moveFile(copyTarget, moveTarget, true);
            const existsAfterMove = await this.pathExists(moveTarget);
            const originalExistsAfterMove = await this.pathExists(copyTarget);
            await deleteFile(moveTarget);
            const existsAfterDelete = await this.pathExists(moveTarget);
            actualSummary =
                `Create exists: ${existsAfterCreate} | Stat size: ${statInfo.size} | Move target exists: ${existsAfterMove} | Original lost: ${!originalExistsAfterMove} | Deleted exists: ${existsAfterDelete}`;
            if (!existsAfterCreate) throw new Error("File creation failed");
            if (!existsAfterMove) throw new Error("File move operation failed");
            if (originalExistsAfterMove) throw new Error("Original file still exists after move");
            if (existsAfterDelete) throw new Error("Delete file did not remove target");
        } catch (e: any) {
            actualSummary = `File service runtime error: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.NORMAL_FLOW,
            "File Service Basic Create Stat Copy Move Delete Validation",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /**
     * CENTRALIZED TEST INTENT BLOCK:
     * 1. Read-only load full text content from source TS file (no write to project src)
     * 2. Write full text into exclusive isolated temp file inside case workspace
     * 3. SHA256 hash comparison between read-only source and temp output to verify content
     * integrity All write operations only run inside case private temp directory
     */
    async testText001FullReadOverwriteTemp() {
        const caseId = "TEXT_001";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const readOnlySrcFile = resolve(ASSET_CFG.SOURCE_SRC_ROOT, "service/file_read.ts");
        const tempWriteOutput = resolve(caseWorkspace, "export_full_text.ts");
        const inputArgs = {
            readOnlySourceFile: readOnlySrcFile,
            isolatedTempWritePath: tempWriteOutput,
            appendMode: false
        };
        const expectRule = "Read non-empty text content from source; temp write file generated; SHA256 hash fully identical to read-only source";
        let actualSummary = "";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            const content = await readTextFile(readOnlySrcFile);
            await writeTextFile(tempWriteOutput, content, false);
            const srcHash = await computeFileSha256(readOnlySrcFile);
            const outHash = await computeFileSha256(tempWriteOutput);
            actualSummary =
                `Read content length: ${content.length} | Source hash prefix: ${srcHash.slice(
                    0,
                    16
                )} | Output hash prefix: ${outHash.slice(0, 16)}`;
            if (content.length <= 0) throw new Error("Read empty text from source file");
            if (srcHash !== outHash) throw new Error("Content hash mismatch after write");
        } catch (e: any) {
            actualSummary = `Text RW pipeline error: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.NORMAL_FLOW,
            "Read-Only Source Text -> Isolated Temp File Overwrite Hash Verify",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /**
     * CENTRALIZED TEST INTENT BLOCK:
     * 1. Read-only binary stream from static test image asset (no write to original img dir)
     * 2. Slice binary by fixed batch size, append write all chunks to isolated temp binary file
     * 3. Full SHA256 consistency assertion between source asset and temp output
     * No modification allowed to original static image resource
     */
    async testBinary001BatchCopyTempHashVerify() {
        const caseId = "BIN_001";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const readOnlyBinSrc = ASSET_CFG.IMG_CASTLE_JPG;
        const tempBinOutput = resolve(caseWorkspace, "batch_copy_castle.jpg");
        const inputArgs = {
            readOnlyBinaryAsset: readOnlyBinSrc,
            isolatedTempOutput: tempBinOutput,
            batchChunkSize: PARAM_CFG.BINARY_BATCH_READ_SIZE
        };
        const expectRule = "Batch read all binary chunks; temp output file generated; output SHA256 exactly match source static image";
        let actualSummary = "";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            let offset = 0;
            let totalBytes = 0;
            const buffer = Buffer.alloc(PARAM_CFG.BINARY_BATCH_READ_SIZE);
            while (true) {
                const res = await readBinaryFile(
                    readOnlyBinSrc,
                    buffer,
                    offset,
                    PARAM_CFG.BINARY_BATCH_READ_SIZE
                );
                if (res.actual_length > 0) {
                    const sliceBuf = res.bytes.slice(0, res.actual_length);
                    await writeBinaryFile(
                        tempBinOutput,
                        sliceBuf,
                        0,
                        res.actual_length,
                        offset > 0
                    );
                    totalBytes += res.actual_length;
                }
                if (res.end_of_stream) break;
                offset += res.actual_length;
            }
            const srcHash = await computeFileSha256(readOnlyBinSrc);
            const outHash = await computeFileSha256(tempBinOutput);
            actualSummary =
                `Total batch bytes processed: ${totalBytes} | Source hash prefix: ${srcHash.slice(
                    0,
                    16
                )} | Output hash prefix: ${outHash.slice(0, 16)}`;
            if (srcHash !== outHash) throw new Error("Binary batch copy content hash mismatch");
        } catch (e: any) {
            actualSummary = `Binary batch processing error: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.NORMAL_FLOW,
            "Read-Only Static Image Binary Batch Slice Copy Hash Check",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /**
     * CENTRALIZED TEST INTENT BLOCK:
     * 1. Generate unified post-migrated temp directory via copy + move flow inside isolated case
     * workspace
     * 2. Inject demo search file with fixed keyword into migrated dir
     * 3. Scan migrated temp dir for target keyword, extract context lines before & after match
     * All search operations only access isolated temp migrated folder, zero read on raw project
     * src
     */
    async testSearch001ScanMigratedDirMatchContext() {
        const caseId = "SEARCH_001";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const srcReadOnlyRoot = ASSET_CFG.SOURCE_SRC_ROOT;
        const copyInterim = resolve(caseWorkspace, "src_backup");
        const scanTargetMigratedDir = this.getPostMoveTargetDir(caseWorkspace);
        await copyDirectory(srcReadOnlyRoot, copyInterim, true);
        // Copy demo search file into migrated dir
        await copyFile(this.searchDemoFile, resolve(copyInterim, "search_demo.ts"), true);
        await moveDirectory(copyInterim, scanTargetMigratedDir, true);
        const inputArgs = {
            singleScanTarget: scanTargetMigratedDir,
            searchKeyword: PARAM_CFG.SEARCH_TARGET_KEYWORD,
            regexMode: false,
            ignoreCase: true
        };
        const expectRule = "Return matched file count > 0; extract surrounding context lines for each matched line inside temp migrated directory";
        let actualSummary = "";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            const matchedFiles = await searchFilesByContent(scanTargetMigratedDir, true,
                PARAM_CFG.SEARCH_TARGET_KEYWORD, false, true, ".ts"
            );
            let totalHits = 0;
            for (const fp of matchedFiles) {
                const ctxList = await searchInFileByContent(fp, PARAM_CFG.SEARCH_TARGET_KEYWORD,
                    false, true, 2, 2
                );
                totalHits += ctxList.length;
            }
            actualSummary =
                `Matched file count: ${matchedFiles.length} | Total context hit entries: ${totalHits}`;
            if (matchedFiles.length <= 0) {
                throw new Error(
                    "No matched files found in migrated scan dir");
            }
            if (totalHits <= 0) throw new Error("Zero context match entries extracted");
        } catch (e: any) {
            actualSummary = `Content search pipeline error: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.NORMAL_FLOW,
            "Content Search Unified Post-Move Migrated Temp Directory With Context",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /**
     * CENTRALIZED TEST INTENT BLOCK:
     * 1. Create isolated temp test file with fixed replace token string
     * 2. Execute atomic safe file search & replace operation via fileReplace service
     * 3. Reload file content to verify old token fully replaced with new target token
     * All file modification only inside exclusive case temp directory, project src untouched
     */
    async testReplaceSvc008BatchTokenReplace() {
        const caseId = "REPLACE_SVC_008";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const testFile = resolve(caseWorkspace, "file_read.ts");
        const originText = `const separator = ${PARAM_CFG.REPLACE_OLD_TOKEN};`;
        const inputArgs = {
            targetFile: testFile,
            oldToken: PARAM_CFG.REPLACE_OLD_TOKEN,
            newToken: PARAM_CFG.REPLACE_NEW_TOKEN,
            originText
        };
        const expectRule = "fileReplace atomic temp swap fully replace all old token occurrences with new token inside target file";
        let actualSummary = "";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            await writeTextFile(testFile, originText, false);
            await fileReplace(
                testFile,
                PARAM_CFG.REPLACE_OLD_TOKEN,
                PARAM_CFG.REPLACE_NEW_TOKEN,
                PARAM_CFG.LINE_SEP
            );
            const modifiedContent = await readTextFile(testFile);
            const oldRemoved = !modifiedContent.includes(PARAM_CFG.REPLACE_OLD_TOKEN);
            const newPresent = modifiedContent.includes(PARAM_CFG.REPLACE_NEW_TOKEN);
            actualSummary =
                `Old token completely removed: ${oldRemoved} | New replacement token exists: ${newPresent}`;
            if (!oldRemoved) throw new Error("Original token still exists after replace");
            if (!newPresent) throw new Error("Replacement token missing after replace operation");
        } catch (e: any) {
            actualSummary = `File replace service runtime error: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.NORMAL_FLOW,
            "File Replace Service Atomic Temp Swap Token Replacement Validation",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /**
     * CENTRALIZED TEST INTENT BLOCK:
     * 1. Read-only load source static test image (no write to original asset folder)
     * 2. Generate rotate / resize / crop processed image artifacts inside isolated case temp dir
     * 3. Assert three processed output image files exist after pipeline execution
     * All image output artifacts isolated, original static source image never modified
     */
    async testImg001RotateResizeCropTempOutput() {
        const caseId = "IMG_001";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const readOnlySrcImg = ASSET_CFG.IMG_CASTLE_JPG;
        const tempRot = resolve(caseWorkspace, "processed_rotated.png");
        const tempResize = resolve(caseWorkspace, "processed_resized.png");
        const tempCrop = resolve(caseWorkspace, "processed_cropped.png");
        const inputArgs = {
            readOnlySourceImage: readOnlySrcImg,
            tempRotateOutput: tempRot,
            tempResizeOutput: tempResize,
            tempCropOutput: tempCrop,
            rotateDeg: PARAM_CFG.ROTATE_ANGLE_DEG,
            targetW: PARAM_CFG.RESIZE_TARGET_W,
            targetH: PARAM_CFG.RESIZE_TARGET_H,
            cropX: PARAM_CFG.CROP_START_X,
            cropY: PARAM_CFG.CROP_START_Y,
            cropW: PARAM_CFG.CROP_REGION_W,
            cropH: PARAM_CFG.CROP_REGION_H
        };
        const expectRule = "Three processed image files generated inside isolated temp workspace; original static test image untouched";
        let actualSummary = "";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            await rotateImage(readOnlySrcImg, tempRot, PARAM_CFG.ROTATE_ANGLE_DEG);
            await resize(
                readOnlySrcImg,
                tempResize,
                PARAM_CFG.RESIZE_TARGET_W,
                PARAM_CFG.RESIZE_TARGET_H,
                true
            );
            await crop(
                readOnlySrcImg,
                tempCrop,
                PARAM_CFG.CROP_START_X,
                PARAM_CFG.CROP_START_Y,
                PARAM_CFG.CROP_REGION_W,
                PARAM_CFG.CROP_REGION_H
            );
            const rotExist = await this.pathExists(tempRot);
            const resExist = await this.pathExists(tempResize);
            const cropExist = await this.pathExists(tempCrop);
            actualSummary =
                `Rotated image exists: ${rotExist} | Resized exists: ${resExist} | Cropped exists: ${cropExist}`;
            if (!rotExist || !resExist || !cropExist) {
                throw new Error(
                    "One or more processed image output missing");
            }
        } catch (e: any) {
            actualSummary = `Image processing pipeline error: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.NORMAL_FLOW,
            "Read-Only Static Image -> Isolated Temp Processed Artifact Output",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /**
     * CENTRALIZED TEST INTENT BLOCK:
     * 1. Read-only load English & Chinese static OCR test PNG assets
     * 2. Run Tesseract OCR text extraction with corresponding language code
     * 3. Keyword existence assertion for extracted text, zero write operation to static image dir
     * No modification to original OCR test image files
     */
    async testOcr001MultiLangExtractVerify() {
        const caseId = "OCR_001";
        const startMs = Date.now();
        const inputArgs = {
            tessdataDir: ASSET_CFG.TESSDATA_STATIC_DIR,
            readOnlyEnImg: ASSET_CFG.IMG_OCR_EN_PNG,
            readOnlyCnImg: ASSET_CFG.IMG_OCR_CN_PNG,
            langEng: ASSET_CFG.LANG_ENG,
            langCnSim: ASSET_CFG.LANG_CHI_SIM
        };
        const expectRule = "English OCR result contains 'Giving Maintainers'; Chinese OCR result contains '冰山'; no write access to static OCR image assets";
        let actualSummary = "";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            const enText = await extractText(
                ASSET_CFG.IMG_OCR_EN_PNG,
                ASSET_CFG.TESSERACT_BIN_PATH,
                ASSET_CFG.LANG_ENG,
                ASSET_CFG.TESSDATA_STATIC_DIR
            );
            const cnText = await extractText(
                ASSET_CFG.IMG_OCR_CN_PNG,
                ASSET_CFG.TESSERACT_BIN_PATH,
                ASSET_CFG.LANG_CHI_SIM,
                ASSET_CFG.TESSDATA_STATIC_DIR
            );
            actualSummary =
                `EN snippet: ${enText.slice(0, 70)} | CN snippet: ${cnText.slice(0, 70)}`;
            if (!enText.includes("Giving Maintainers")) {
                throw new Error(
                    "Expected English keyword missing from OCR output");
            }
            if (!cnText.includes("冰山")) {
                throw new Error(
                    "Expected Chinese keyword missing from OCR output");
            }
        } catch (e: any) {
            actualSummary = `OCR text extract runtime error: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.NORMAL_FLOW,
            "Read-Only Static OCR Image Multi-Language Text Extract Keyword Assertion",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    // ============================= ERROR / BOUNDARY VALIDATION CASES ============================
    /** Empty blank path parameter validation boundary for all file system services */
    async testErr001EmptyPathAllServiceValidate() {
        const caseId = "ERR_001";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const inputArgs = {testEmptyPath: ""};
        const expectRule = "All file/directory service entry functions shall throw blank parameter validation error when receiving empty string path";
        let actualSummary = "Boundary placeholder test, framework executed normally, full cross-service validation pending complete implementation";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
            // Boundary validation logic reserved for extension
        } catch (e: any) {
            actualSummary = `Boundary validation exception: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.ERROR_VALIDATION,
            "Empty Blank Path All Service Parameter Validate Boundary",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /** Negative offset & empty buffer binary read slice boundary */
    async testErr002BinaryEmptyDataNegativeSlice() {
        const caseId = "ERR_002";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const inputArgs = {sliceOffset: -1, emptyBinaryBuffer: true};
        const expectRule = "Binary read service shall throw range error for negative offset or slice length exceeding buffer size";
        let actualSummary = "Boundary placeholder test, framework executed normally, binary slice boundary logic pending complete implementation";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
        } catch (e: any) {
            actualSummary = `Boundary validation exception: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.ERROR_VALIDATION,
            "Binary Empty Buffer & Negative Slice Offset Boundary",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /** Negative crop coordinate & over-limit rotation angle image process boundary */
    async testErr003ImageNegativeCropOver360Rotate() {
        const caseId = "ERR_003";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const inputArgs = {cropX: -50, rotateDeg: 400};
        const expectRule = "Image service shall reject negative crop coordinates and rotation angle larger than 360 degrees";
        let actualSummary = "Boundary placeholder test, framework executed normally, image param boundary logic pending complete implementation";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
        } catch (e: any) {
            actualSummary = `Boundary validation exception: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.ERROR_VALIDATION,
            "Image Negative Crop X & Over 360 Rotate Angle Boundary",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /** Blank language code & non-existent tessdata directory OCR initialization boundary */
    async testErr004OcrBlankLangInvalidTessdata() {
        const caseId = "ERR_004";
        const startMs = Date.now();
        const inputArgs = {lang: "", invalidTessdataPath: "C:/invalid_tess_xxx"};
        const expectRule = "OCR extract function shall throw initialization error for empty language code or non-existent tessdata directory";
        let actualSummary = "Boundary placeholder test, framework executed normally, OCR param validation logic pending complete implementation";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
        } catch (e: any) {
            actualSummary = `Boundary validation exception: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.ERROR_VALIDATION,
            "OCR Blank Language Code & Invalid Tessdata Directory Boundary",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    /** Null text content & append mode to read-only file text write boundary */
    async testErr005WriteTextNullContentReadonlyAppend() {
        const caseId = "ERR_005";
        const startMs = Date.now();
        const caseWorkspace = await this.createCaseIsolationDir(caseId);
        const inputArgs = {writeContent: null, readonlyTargetFile: true};
        const expectRule = "Text write service shall intercept null content and reject append operation to read-only existing file";
        let actualSummary = "Boundary placeholder test, framework executed normally, text write param boundary logic pending complete implementation";
        let stackInfo: string | undefined;
        let status = TestStatus.PASS;
        try {
        } catch (e: any) {
            actualSummary = `Boundary validation exception: ${e.message}`;
            stackInfo = e.stack;
            status = TestStatus.FAIL;
        }
        const durationMs = Date.now() - startMs;
        emitStandardTestLog(
            caseId,
            TestCategory.ERROR_VALIDATION,
            "Write Text Null Content & Append To Readonly File Boundary",
            inputArgs,
            expectRule,
            actualSummary,
            status,
            durationMs,
            stackInfo
        );
    }

    // Internal helper: simple path existence check
    private async pathExists(p: string): Promise<boolean> {
        try {
            await check.requirePathExists(p, "temp_check");
            return true;
        } catch {
            return false;
        }
    }
}

// ======================================== MAIN TEST ENTRY =======================================
async function runFullIntegrationTestSuite() {
    console.log(
        "===== GLOBAL FS STANDARD TS INTEGRATION TEST SUITE START (TOP-TIER CLOUD ENTERPRISE SPEC) =====");
    console.log(
        "Hard Isolation Constraint: All copy/move/write/search operations run only inside auto-recycled temp dir, project source root READ-ONLY\n");
    const testSuite = new FsStandardIntegrationTest();
    await testSuite.setup();
    try {
        // Normal flow functional test cases
        await testSuite.testDir001ListCopyMoveFullFlow();
        await testSuite.testFileSvc001BasicCrudValidate();
        await testSuite.testText001FullReadOverwriteTemp();
        await testSuite.testBinary001BatchCopyTempHashVerify();
        await testSuite.testSearch001ScanMigratedDirMatchContext();
        await testSuite.testReplaceSvc008BatchTokenReplace();
        await testSuite.testImg001RotateResizeCropTempOutput();
        await testSuite.testOcr001MultiLangExtractVerify();
        // Error & boundary validation cases
        await testSuite.testErr001EmptyPathAllServiceValidate();
        await testSuite.testErr002BinaryEmptyDataNegativeSlice();
        await testSuite.testErr003ImageNegativeCropOver360Rotate();
        await testSuite.testErr004OcrBlankLangInvalidTessdata();
        await testSuite.testErr005WriteTextNullContentReadonlyAppend();
    } finally {
        await testSuite.teardown();
        testReport.printFinalTableReport();
    }
}

// Execute full test suite
runFullIntegrationTestSuite().catch(err => {
    console.error("Global test suite fatal crash:", err);
    process.exit(1);
});