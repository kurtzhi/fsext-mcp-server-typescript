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
 * Directory operation MCP tool module
 * Provides tools for directory traversal, full directory copy and directory move.
 * All tools enforce workspace access restriction to limit file system scope.
 */

import {z} from "zod";

import {
    listDirectory,
    copyDirectory,
    moveDirectory
} from "../index.js";
import {mcp} from "../instance.js";
import {restrictWorkspace} from "../path_restrict.js";
import {responseHelper} from "../response_helper.js";
import {requirePathExists} from "../service/check.utils.js";

// fs_list_directory
mcp.addTool({
    name: "fs_list_directory",
    description: "Scan directory, return matched absolute path list.",
    parameters: z.object({
        source_dir: z.string(),
        recursive: z.boolean(),
        only_files: z.boolean(),
        file_extension: z.string().default("").optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["source_dir"])
    (async (args) => {
            const source_dir = args.source_dir as string;
            const recursive = args.recursive as boolean;
            const only_files = args.only_files as boolean;
            const file_extension = args.file_extension as string;
            await requirePathExists(source_dir, "source_dir");
            const paths = await listDirectory(
                source_dir,
                recursive,
                only_files,
                file_extension
            );
            return {paths: paths};
        }))
});

// fs_copy_directory
mcp.addTool({
    name: "fs_copy_directory",
    description: "Copy full directory tree, overwrite controls existing target cleanup.",
    parameters: z.object({
        source_dir: z.string(),
        copy_dest_dir: z.string(),
        overwrite: z.boolean().default(false).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["source_dir", "copy_dest_dir"])
    (async (args) => {
            const source_dir = args.source_dir as string;
            const copy_dest_dir = args.copy_dest_dir as string;
            const overwrite = args.overwrite as boolean;
            await requirePathExists(source_dir, "source_dir");
            await copyDirectory(source_dir, copy_dest_dir, overwrite);
            return {};
        }))
});

// fs_move_directory
mcp.addTool({
    name: "fs_move_directory",
    description: "Move directory, fail if destination exists.",
    parameters: z.object({
        source_dir: z.string(),
        dest_dir: z.string(),
        overwrite: z.boolean().default(false).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["source_dir", "dest_dir"])
    (async (args) => {
            const source_dir = args.source_dir as string;
            const dest_dir = args.dest_dir as string;
            const overwrite = args.overwrite as boolean;
            await requirePathExists(source_dir, "source_dir");
            await moveDirectory(source_dir, dest_dir, overwrite);
            return {};
        }))
});