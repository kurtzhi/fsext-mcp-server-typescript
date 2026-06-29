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
 * MCP tool response standardization & global error handling utilities.
 * Defines unified return type for all filesystem MCP tools.
 * Provides consistent JSON response wrapping, centralized exception capture and categorized error output.
 * Integrates winston logger to record access blocks, permission failures, IO and internal runtime exceptions.
 * responseHelper decorator eliminates repetitive try/catch boilerplate for every tool implementation.
 */

import winston from "winston";
import {WorkspaceEscapeError} from "./tool_error.js";


export type McpToolReturn = {
    content: Array<{ type: "text"; text: string }>;
};
export type ToolFunc = (args: Record<string, any>) => Promise<McpToolReturn>;

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.simple()
    ),
    transports: [new winston.transports.Console()],
});

/**
 * Generate standardized unified response object for MCP tool return
 * @param success Operation overall status flag
 * @param info Raw business data on success; {code, message} dict on failure
 * @returns Standardized response payload
 */
export function buildResponse(success: boolean, info: any) {
    const raw = {res: {success, info}};
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(raw)
            }
        ]
    };
}

/**
 * Async decorator for MCP file system tools:
 * - Catch workspace sandbox, validation, permission, IO & unhandled errors
 * - Wrap raw business output to unified MCP response object
 * - Log full stack trace internally, expose minimal clean error to client
 * @param fn Original async tool handler function
 * @returns Wrapped handler with global error capture & response formatting
 */
export function responseHelper<T extends (args: Record<string, any>) => Promise<any>>(fn: T): ToolFunc {
    return async (args: Record<string, any>) => {
        try {
            const rawOutput = await fn(args);
            return buildResponse(true, rawOutput);
        } catch (err) {
            const funcName = fn.name || "unknown_tool";
            if (err instanceof WorkspaceEscapeError) {
                logger.warn(`[TOOL:${funcName}] Workspace escape blocked: ${err.message}`);
                return buildResponse(false, {
                    code: "WORKSPACE_ESCAPE_FORBIDDEN",
                    message: err.message,
                });
            }
            const nodeErr = err as NodeJS.ErrnoException;
            if (nodeErr.code === "EACCES") {
                const msg = `Permission denied: ${(
                    err as Error
                ).message}`;
                logger.warn(`[TOOL:${funcName}] Access forbidden: ${msg}`, err);
                return buildResponse(false, {code: "PERMISSION_DENIED", message: msg});
            }
            if (nodeErr.syscall) {
                const msg = `File system operation failed: ${(
                    err as Error
                ).message}`;
                logger.error(`[TOOL:${funcName}] IO exception: ${msg}`, err);
                return buildResponse(false, {code: "IO_ERROR", message: msg});
            }
            if (err instanceof Error) {
                logger.warn(`[TOOL:${funcName}] Parameter validation failed: ${err.message}`, err);
                return buildResponse(false, {code: "VALIDATION_ERROR", message: err.message});
            }
            const errCls = (
                err as Error
            ).constructor.name;
            const msg = `Internal runtime error: ${errCls}`;
            logger.error(`[TOOL:${funcName}] Unhandled exception`, err);
            return buildResponse(false, {code: "INTERNAL_ERROR", message: msg});
        }
    };
}