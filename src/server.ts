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
 * Main CLI entry file for fsext-mcp-server.
 * Parses startup command-line arguments via minimist, initializes global workspace directory lock restriction.
 * Auto loads all registered MCP tool modules, supports stdio, HTTP and SSE transport modes.
 * Validates lock-root directory permission, prints startup banner for network transports only.
 * Handles fatal top-level startup exceptions and exits with error code on initialization failure.
 */

import {resolve} from "path";

import minimist from "minimist";

import {mcp} from "./instance.js";
import {cleanPath, GLB_STATE} from "./path_restrict.js";
import {requireNonBlank, requireWritableDirectory} from "./service/check.utils.js";
import "./tool/fs_dir.js"
import "./tool/fs_base.js"
import "./tool/fs_read_write.js"
import "./tool/fs_search_replace.js"
import "./tool/fs_img.js"


async function main() {
    const argv = minimist(process.argv.slice(2));

    if (argv.help || argv.h) {
        console.error(`
fsext-mcp-server-typescript - Filesystem MCP Server
Options:
  --transport     Transport mode: stdio | sse | http (default: stdio)
  --host          Bind host address (default: 127.0.0.1)
  --port          Listen port number (default: 8000)
  --lock-root     Restrict all file operations inside this directory
  --origin        CORS allow origin (default: *)
  -h, --help      Show this help message
`);
        process.exit(0);
    }

    const transport = (argv.transport || "stdio").toLowerCase();
    const host = argv.host || "127.0.0.1";
    const port = Number(argv.port || 8000);
    const lockRootRaw = argv["lock-root"];
    const corsOrigin = argv.origin ?? "*";

    const allowedTransports = ["stdio", "sse", "http", "httpstream"];
    if (!allowedTransports.includes(transport)) {
        console.error(`Error: Unsupported transport "${transport}". Allowed: ${allowedTransports.join(", ")}`);
        process.exit(1);
    }

    if (lockRootRaw && lockRootRaw.trim() !== "") {
        const rawLockStr = lockRootRaw.trim();
        const normalizedLockStr = cleanPath(rawLockStr);
        const lockAbs = resolve(normalizedLockStr);
        requireNonBlank(lockAbs, "lock-root");
        await requireWritableDirectory(lockAbs, "lock-root");

        GLB_STATE.lockRoot = lockAbs;
        console.error(`[LOCK_INIT] Raw input lock-root: ${rawLockStr}`);
        console.error(`[LOCK_INIT] Normalized global lock root: ${lockAbs}`);
    }

    if (transport !== "stdio") {
        console.error("=".repeat(64));
        console.error(`fsext-mcp-server | Transport: ${transport}`);
        const lockVal= GLB_STATE.lockRoot ?? "Unrestricted (full filesystem access)";
        console.error(`Workspace Lock Root: ${lockVal}`);
        console.error(`CORS Allow Origin: ${corsOrigin}`);
        console.error(`Listening on ${host}:${port}`);
        console.error("=".repeat(64));
    }

    if (["sse", "http", "httpstream"].includes(transport)) {
        await mcp.start({
            transportType: "httpStream",
            httpStream: {
                host,
                port,
                stateless: false,
                cors: {
                    origin: corsOrigin,
                    methods: ["GET", "POST", "OPTIONS"],
                    allowedHeaders: "*",
                    credentials: true
                }
            }
        });
    } else {
        await mcp.start({
            transportType: "stdio"
        });
    }
}

main().catch((err) => {
    console.error("Server startup fatal error:", err);
    process.exit(1);
});