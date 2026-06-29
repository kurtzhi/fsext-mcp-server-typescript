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
 * File read & write MCP tool module
 * Supports full/slice text reading, chunked binary reading, text/binary file writing.
 * All file access paths are limited to the permitted workspace scope.
 */

import {z} from "zod";

import {Charset} from "./charset.js";
import {
    readTextFile,
    readTextFileRange,
    readBinaryFile,
    writeTextFile,
    writeBinaryFile
} from "../index.js";
import {mcp} from "../instance.js";
import {restrictWorkspace} from "../path_restrict.js";
import {responseHelper} from "../response_helper.js";
import {requirePathExists} from "../service/check.utils.js";


// fs_read_full_text
mcp.addTool({
    name: "fs_read_full_text",
    description: "Read entire text file.",
    parameters: z.object({
        file_path: z.string(),
        charset: z.nativeEnum(Charset).default(Charset.UTF8).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const charset = args.charset ?? Charset.UTF8;
        await requirePathExists(file_path, "file_path");
        const content = await readTextFile(file_path, charset);
        return {content: content};
    }))
});

// fs_read_text_range
mcp.addTool({
    name: "fs_read_text_range",
    description: "Read partial lines of text file.",
    parameters: z.object({
        file_path: z.string(),
        lines_to_skip: z.number().int().min(0),
        max_lines_to_read: z.number().int().min(0),
        line_separator: z.string().default("\n").optional(),
        charset: z.nativeEnum(Charset).default(Charset.UTF8).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const lines_to_skip = args.lines_to_skip as number;
        const max_lines_to_read = args.max_lines_to_read as number;
        const line_separator = args.line_separator as string;
        const charset = args.charset ?? Charset.UTF8;
        await requirePathExists(file_path, "file_path");
        return readTextFileRange(
            file_path,
            lines_to_skip,
            max_lines_to_read,
            line_separator,
            charset
        );
    }))
});

// fs_read_binary_chunk
mcp.addTool({
    name: "fs_read_binary_chunk",
    description: "Read partial binary file, return base64 encoded bytes.",
    parameters: z.object({
        file_path: z.string(),
        bytes_to_skip: z.number().int().min(0),
        max_bytes_to_read: z.number().int().min(0)
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const bytes_to_skip = args.bytes_to_skip as number;
        const max_bytes_to_read = args.max_bytes_to_read as number;
        await requirePathExists(file_path, "file_path");
        const res = await readBinaryFile(file_path,
            null, bytes_to_skip, max_bytes_to_read
        );
        return {
            data_base64: res.bytes.toString("base64"),
            raw_bytes_length: res.actual_length,
            end_of_stream: res.end_of_stream
        };
    }))
});

// fs_write_text
mcp.addTool({
    name: "fs_write_text",
    description: "Write text content to file.",
    parameters: z.object({
        file_path: z.string(),
        text: z.string().nonempty(),
        append: z.boolean().default(false),
        charset: z.nativeEnum(Charset).default(Charset.UTF8).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const text = args.text as string;
        const append = args.append as boolean;
        const charset = args.charset ?? Charset.UTF8;
        await writeTextFile(file_path, text, append, charset);
        return {};
    }))
});

// fs_write_binary
mcp.addTool({
    name: "fs_write_binary",
    description: "Decode base64 data to binary bytes and write bytes to file.",
    parameters: z.object({
        file_path: z.string(),
        base64_data: z.string().nonempty(),
        append: z.boolean().default(false).optional()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["file_path"])
    (async (args) => {
        const file_path = args.file_path as string;
        const base64_data = args.base64_data as string;
        const append = args.append as boolean;
        const bytes = Buffer.from(base64_data, "base64");
        await writeBinaryFile(file_path, bytes, 0, bytes.length, append);
        return {};
    }))
});