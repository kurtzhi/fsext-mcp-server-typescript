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
 * Root module entry barrel file.
 * Aggregates and re-exports all core filesystem, image and OCR service utilities.
 * Provides a single unified import entry for all file operation logic across the MCP server.
 */

export * from './service/dir.js';
export * from './service/file.js';
export * from './service/file_read.js';
export * from './service/file_replace.js';
export * from './service/file_search.js';
export * from './service/file_write.js';
export * from './service/image.js';
export * from './service/ocr.js';