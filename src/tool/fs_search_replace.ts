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
 * File search and text replace MCP tool module Provides directory/file content search
 * with regex support and contextual preview, plus in-place text replacement for single
 * files. All directory and file paths are restricted within allowed workspace.
 */

import {z} from "zod";

import {Charset} from "./charset.js";
import {
    searchFilesByContent,
    searchInFilesByContent,
    searchInFileByContent,
    fileReplace
} from "../index.js";
import {mcp} from "../instance.js";
import {restrictWorkspace} from "../path_restrict.js";
import {responseHelper} from "../response_helper.js";
import {requirePathExists} from "../service/check.utils.js";


// fs_search_files_by_content
mcp.addTool({
    name: "fs_search_files_by_content",
    description: "Scan directories and return paths of files containing target text.",
    parameters: z.object({
        dir_path: z.string(),
        recursive: z.boolean(),
        search_term: z.string(),
        is_regex: z.boolean().default(false).optional(),
        ignore_case: z.boolean().default(true).optional(),
        file_extension: z.string().default("").optional(),
        charset: z.nativeEnum(Charset).default(Charset.UTF8).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["dir_path"])
    (async (args) => {
        const dir_path = args.dir_path as string;
        const recursive = args.recursive as boolean;
        const search_term = args.search_term as string;
        const is_regex = args.is_regex as boolean;
        const ignore_case = args.ignore_case as boolean;
        const file_extension = args.file_extension as string;
        const charset = args.charset ?? Charset.UTF8;

        await requirePathExists(dir_path, "dir_path");
        const paths = await searchFilesByContent(dir_path, recursive, search_term,
            is_regex, ignore_case, file_extension, charset
        );
        return {paths: paths};
    }))
});

// fs_search_in_files_by_content
mcp.addTool({
    name: "fs_search_in_files_by_content",
    description: "Search multiple files and return matched lines with context.",
    parameters: z.object({
        dir_path: z.string(),
        recursive: z.boolean(),
        search_term: z.string(),
        limit: z.number().int(),
        is_regex: z.boolean().default(false).optional(),
        ignore_case: z.boolean().default(true).optional(),
        lines_before: z.number().int().min(0).default(0).optional(),
        lines_after: z.number().int().min(0).default(0).optional(),
        file_extension: z.string().default("").optional(),
        charset: z.nativeEnum(Charset).default(Charset.UTF8).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["dir_path"])
    (async (args) => {
        const dir_path = args.dir_path as string;
        const recursive = args.recursive as boolean;
        const search_term = args.search_term as string;
        const is_regex = args.is_regex as boolean;
        const ignore_case = args.ignore_case as boolean;
        const limit = args.limit as number;
        const lines_before = args.lines_before as number;
        const lines_after = args.lines_after as number;
        const file_extension = args.file_extension as string;
        const charset = args.charset ?? Charset.UTF8;

        await requirePathExists(dir_path, "dir_path");
        const results = await searchInFilesByContent(dir_path, recursive,
            search_term, limit, is_regex, ignore_case,
            lines_before, lines_after, file_extension, charset
        );
        return {results: results};
    }))
});

// fs_search_in_file_by_content
mcp.addTool({
    name: "fs_search_in_file_by_content",
    description: "Search single file and return matched lines with context.",
    parameters: z.object({
        file_path: z.string(),
        search_term: z.string(),
        is_regex: z.boolean().default(false).optional(),
        ignore_case: z.boolean().default(true).optional(),
        lines_before: z.number().int().min(0).default(0).optional(),
        lines_after: z.number().int().min(0).default(0).optional(),
        charset: z.nativeEnum(Charset).default(Charset.UTF8).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const search_term = args.search_term as string;
        const is_regex = args.is_regex as boolean;
        const ignore_case = args.ignore_case as boolean;
        const lines_before = args.lines_before as number;
        const lines_after = args.lines_after as number;
        const charset = args.charset ?? Charset.UTF8;

        await requirePathExists(file_path, "file_path");
        const results = await searchInFileByContent(file_path, search_term,
            is_regex, ignore_case, lines_before, lines_after, charset
        );
        return {results: results};
    }))
});

// fs_file_replace
mcp.addTool({
    name: "fs_file_replace",
    description: "Replace text content inside file, return match count.",
    parameters: z.object({
        file_path: z.string(),
        search_term: z.string(),
        replacement: z.string(),
        line_separator: z.string().default("\n").optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const search_term = args.search_term as string;
        const replacement = args.replacement as string;
        const line_separator = args.line_separator as string;

        await requirePathExists(file_path, "file_path");
        const count = await fileReplace(file_path, search_term,
            replacement, line_separator
        );
        return {count: count};
    }))
});