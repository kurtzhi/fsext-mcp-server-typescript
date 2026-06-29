// SPDX-FileCopyrightText: 2026 https://github.com/kurtzhi/fsext-mcp-server-typescript
// SPDX-License-Identifier: Apache-2.0

/*
 * Copyright 2026 https://github.com/kurtzhi/fsext-mcp-server-typescript
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
 * File operation tool collection
 * Provides all basic single-file manipulation MCP tools, with workspace path access control.
 * Covers file creation, deletion, metadata query, existence check, copy and move operations.
 * All tools enforce workspace directory restriction to prevent unauthorized path access.
 */

import {z} from "zod";

import {Charset} from "./charset.js";
import {
    getFileInfo,
    create_file,
    deleteFile,
    copyFile,
    moveFile, isFileExists
} from "../index.js";
import {mcp} from "../instance.js";
import {requirePathExists} from "../service/check.utils.js";
import {restrictWorkspace} from "../path_restrict.js";
import {responseHelper} from "../response_helper.js";

// fs_create_file
mcp.addTool({
    name: "fs_create_file",
    description: "Create a file, auto create missing parent directories.",
    parameters: z.object({
        file_path: z.string(),
        content: z.string().default("").optional(),
        charset: z.nativeEnum(Charset)
                  .default(Charset.UTF8)
                  .optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const content = args.content as string;
        const charset = args.charset ?? Charset.UTF8;
        await create_file(file_path, content, charset);
        return {};
    }))
});

// fs_delete_file
mcp.addTool({
    name: "fs_delete_file",
    description: "Delete single regular file, reject directory.",
    parameters: z.object({
        file_path: z.string()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        await requirePathExists(file_path, "file_path");
        await deleteFile(file_path);
        return {};
    }))
});

// fs_copy_file
mcp.addTool({
    name: "fs_copy_file",
    description: "Copy file with metadata, overwrite toggle.",
    parameters: z.object({
        source_file_path: z.string(),
        dest_file_path: z.string(),
        overwrite: z.boolean().default(false).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["source_file_path", "dest_file_path"])
    (async (args) => {
        const source_file_path = args.source_file_path as string;
        const dest_file_path = args.dest_file_path as string;
        const overwrite = args.overwrite as boolean;
        await requirePathExists(source_file_path, "source_file_path");
        await copyFile(source_file_path, dest_file_path, overwrite);
        return {};
    }))
});

// fs_move_file
mcp.addTool({
    name: "fs_move_file",
    description: "Move file, control overwrite behavior.",
    parameters: z.object({
        source_file_path: z.string(),
        dest_file_path: z.string(),
        overwrite: z.boolean().default(false).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["source_file_path", "dest_file_path"])
    (async (args) => {
        const source_file_path = args.source_file_path as string;
        const dest_file_path = args.dest_file_path as string;
        const overwrite = args.overwrite as boolean;
        await requirePathExists(source_file_path, "source_file_path");
        await moveFile(source_file_path, dest_file_path, overwrite);
        return {};
    }))
});

// fs_get_file_info
mcp.addTool({
    name: "fs_get_file_info",
    description: "Get full file/directory metadata.",
    parameters: z.object({
        file_path: z.string(),
        calc_digest: z.boolean().default(false).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const calc_digest = args.calc_digest as boolean;
        await requirePathExists(file_path, "file_path");
        return await getFileInfo(file_path, calc_digest);
    }))
});

// fs_is_file_exists
mcp.addTool({
    name: "fs_is_file_exists",
    description: "Check filesystem entry existence.",
    parameters: z.object({
        file_path: z.string()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const exists = await isFileExists(file_path, "file_path");
        return {exists: exists};
    }))
});