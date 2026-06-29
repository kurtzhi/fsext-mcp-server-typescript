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
 * Workspace path restriction core utilities.
 * Implements global directory isolation logic to prevent path traversal and cross-workspace access.
 * Provides path normalization, boundary checking and a reusable tool decorator for MCP input validation.
 * A global lock root directory controls permission scope; empty lock mode disables all path restrictions.
 */

import {resolve} from "path";

import winston from "winston";

import {WorkspaceEscapeError} from "./tool_error.js";
import {requireNonBlank, requireWritableDirectory} from "./service/check.utils.js";


const logger = winston.createLogger({
    level: "warn",
    format: winston.format.simple(),
    transports: [new winston.transports.Console()],
});


/**
 * Global workspace lock root absolute path; null means unrestricted mode
 */
export const GLB_STATE = {
    lockRoot: null as string | null,
};

/**
 * Normalize file path:
 * 1. Strip leading/trailing whitespace
 * 2. Replace backslash with forward slash
 * 3. Remove redundant consecutive separators
 * @param rawPath Raw input path string
 * @returns Normalized unix-style path string
 */
export function cleanPath(rawPath: string): string {
    if (!rawPath) return "";
    let stripped = rawPath.trim();
    let unixStyle = stripped.replace(/\\/g, "/");
    while (unixStyle.includes("//")) {
        unixStyle = unixStyle.replace("//", "/");
    }
    return unixStyle;
}

/**
 * Verify target path is strictly inside restricted lock root directory.
 * Resolve symlinks & normalize paths to prevent path traversal escape.
 * @param lockRoot Root workspace directory enforced by server startup arg
 * @param targetPath File/directory path from MCP tool input to validate
 * @returns True if target is within lock root subtree; False if out of bounds
 */
export function folderLockCheck(lockRoot: string, targetPath: string): boolean {
    requireNonBlank(lockRoot, "lock_root");
    const lockRootAbs = resolve(lockRoot);
    requireWritableDirectory(lockRootAbs, "lock_root");
    requireNonBlank(targetPath, "target_path");

    const rootReal = resolve(lockRootAbs);
    const targetReal = resolve(targetPath);
    const rootWithSep = rootReal + "/";
    return targetReal === rootReal || targetReal.startsWith(rootWithSep);
}

/**
 * Decorator factory for FastMCP async tools to auto validate all file/dir input paths.
 * Skips all validation automatically if GLOBAL_LOCK_ROOT is null (unrestricted mode).
 * Throws standardized WorkspaceEscapeError to block cross-workspace access.
 * @param pathArgumentNames List of tool param names that carry file/directory paths
 * @returns Decorator wrapping original tool function
 */
export function restrictWorkspace<F extends (args: Record<string, any>) => Promise<any>>(pathKeys: string[]) {
    return function wrap(fn: F): F {
        const wrapped = async function (args: Record<string, any>) {
            const lockRoot = GLB_STATE.lockRoot;
            if (lockRoot === null) {
                return fn(args);
            }

            const lockAbs = resolve(lockRoot);
            const safeLock = cleanPath(lockAbs);
            const safeLockDir = safeLock.endsWith("/") ? safeLock : `${safeLock}/`;

            for (const field of pathKeys) {
                const rawPath = args[field];
                if (!rawPath) continue;

                const targetAbs = resolve(rawPath);
                const safeTarget = cleanPath(targetAbs);

                // Allow exact workspace root OR any sub item under root
                const isExactRoot = safeTarget === safeLock;
                const isChildPath = safeTarget.startsWith(safeLockDir);
                if (!isExactRoot && !isChildPath) {
                    const msg = `Access restricted: Path \`${rawPath}\` is outside allowed workspace \`${lockRoot}\``;
                    console.warn(`Block cross workspace access: ${msg}`);
                    throw new WorkspaceEscapeError(msg);
                }
            }

            return fn(args);
        };
        return wrapped as unknown as F;
    };
}