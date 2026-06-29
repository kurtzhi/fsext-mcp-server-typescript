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
 * Image processing & OCR MCP tool module
 * Provides image resizing, cropping, rotation and Tesseract text extraction tools.
 * All file path parameters are restricted within the allowed workspace directory.
 */

import {z} from "zod";

import {
    resize,
    crop,
    rotateImage,
    extractText_wasm,
    extractText
} from "../index.js";
import {mcp} from "../instance.js";
import {restrictWorkspace} from "../path_restrict.js";
import {responseHelper} from "../response_helper.js";
import {requirePathExists} from "../service/check.utils.js";


// fs_image_resize
mcp.addTool({
    name: "fs_image_resize",
    description: "Resize image with ratio lock and padding support.",
    parameters: z.object({
        source_path: z.string(),
        dest_path: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        keep_aspect_ratio: z.boolean().default(true)
    }).strict(),
    execute: responseHelper(restrictWorkspace(["source_path", "dest_path"])
    (async (args) => {
        const source_path = args.source_path as string;
        const dest_path = args.dest_path as string;
        const width = args.width as number;
        const height = args.height as number;
        const keep_aspect_ratio = args.keep_aspect_ratio as boolean;
        await requirePathExists(source_path, "source_path");
        await resize(source_path, dest_path, width, height, keep_aspect_ratio);
        return {};
    }))
});

// fs_image_crop
mcp.addTool({
    name: "fs_image_crop",
    description: "Crop rectangular region from image.",
    parameters: z.object({
        source_path: z.string(),
        dest_path: z.string(),
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        width: z.number().int().positive(),
        height: z.number().int().positive()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["source_path", "dest_path"])
    (async (args) => {
        const source_path = args.source_path as string;
        const dest_path = args.dest_path as string;
        const x = args.x as number;
        const y = args.y as number;
        const width = args.width as number;
        const height = args.height as number;
        await requirePathExists(source_path, "source_path");
        await crop(source_path, dest_path, x, y, width, height);
        return {};
    }))
});

// fs_image_rotate
mcp.addTool({
    name: "fs_image_rotate",
    description: "Rotate image clockwise.",
    parameters: z.object({
        source_path: z.string(),
        dest_path: z.string(),
        degrees: z.number()
    }).strict(),
    execute: responseHelper(restrictWorkspace(["source_path", "dest_path"])
    (async (args) => {
        const source_path = args.source_path as string;
        const dest_path = args.dest_path as string;
        const degrees = args.degrees as number;
        await requirePathExists(source_path, "source_path");
        await rotateImage(source_path, dest_path, degrees);
        return {};
    }))
});

// fs_ocr_extract_text
mcp.addTool({
    name: "fs_ocr_extract_text",
    description: "Extract text from image via Tesseract OCR.",
    parameters: z.object({
        image_path: z.string().describe("Input image path"),
        tesseract_bin_path: z.string().default("").optional().describe(
            "Tesseract binary path, empty uses WASM"),
        tessdata_path: z.string().default("").optional(),
        lang: z.string().default("eng").describe("must match tessdata language file prefix")
    }).strict(),
    execute: responseHelper(restrictWorkspace(["image_path"])
    (async (args) => {
        const image_path = args.image_path as string;
        const tesseract_bin_path = args.tesseract_bin_path as string;
        const tessdata_path = args.tessdata_path as string;
        const lang = args.lang as string;
        await requirePathExists(image_path, "image_path");
        const content = tesseract_bin_path
            ? await extractText(image_path, tesseract_bin_path, lang, tessdata_path)
            : await extractText_wasm(image_path, tessdata_path, lang);
        return {content: content};
    }))
});