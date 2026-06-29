# FsExt\-MCP\-Server \(TypeScript\)

## Overview

A high\-performance, secure, and production\-grade Model Context Protocol \(MCP\) server built with TypeScript, providing comprehensive filesystem operations, advanced text search \& replace, image processing, and Tesseract OCR capabilities\. Designed for LLM agent integration, it delivers strict input validation, standardized response structures, streaming large\-file processing, and multi\-transport remote deployment support\.

This server fully complies with the official MCP specification, supporting`stdio` local integration, `SSE` legacy streaming transport, and modern `Streamable HTTP` bidirectional transport, serving as a universal filesystem tool backend for AI agents and automated workflow systems\.

## Core Features

- **Full Filesystem CRUD \& Directory Management**：Complete file/directory creation, deletion, copy, move, metadata query, and existence verification\. Supports recursive full\-directory tree replication and safe move operations with conflict protection\.

- **Streaming File I/O for Large Files**：Implements segmented text reading, chunked binary streaming reading, text/binary overwriting and appending\. Avoids full memory loading, perfectly supporting GB\-level large file processing\.

- **Advanced Text Search \& In\-Place Replace**：Directory\-wide recursive content search, single/multi\-file contextual matching with preview lines, regular expression support, case\-insensitive matching, and precise in\-file text replacement with change statistics\.

- **Professional Image Processing Suite**：Built\-in high\-performance image resize \(aspect ratio lock support\), precise crop, and arbitrary\-angle rotation based on Sharp, covering mainstream image editing scenarios\.

- **Cross\-Platform Tesseract OCR**：WASM\-first OCR recognition with customizable local Tesseract binary and tessdata paths, supporting multi\-language text extraction from images without local engine installation dependency\.

- **Strict Strict Input Validation \& Standardized Response**：All tool schemas enable strict additional property prohibition, with unified success/error response structures for consistent client parsing and error handling\.

- **Multi\-Standard MCP Transports**：Natively supports three official MCP transports: `stdio` \(local client\), `SSE` \(legacy remote stream\), `Streamable HTTP` \(modern bidirectional remote transport\)\.

- **Full TypeScript Type Safety**：Complete type definitions for all tool parameters, response structures, and transport configurations, ensuring runtime stability and development friendliness\.

## Quick Start

### Prerequisites

Node\.js `>=22.0.0 <27.0.0`

### Installation

#### Global Installation \(Recommended for CLI Usage\)

```bash
npm install -g fsext-mcp-server
```

#### Local Project Installation

```bash
npm install fsext-mcp-server
```

### Startup Commands

#### 1\. Default Stdio Mode \(For Claude Desktop / Cursor / Local MCP Clients\)

```bash
# Default stdio transport for local agent integration
fsext-mcp-server

# Short alias
fsext
```

#### 2\. SSE Remote Transport Mode

```bash
fsext-mcp-server --transport sse --host 0.0.0.0 --port 8000
```

**Endpoints**:

- SSE Stream Subscription:`http://<host>:<port>/sse`

- Client Request Channel: `http://<host>:<port>/messages`

#### 3\. Modern Streamable HTTP Transport Mode

```bash
fsext-mcp-server --transport http --host 0.0.0.0 --port 8000
```

**Unified Bidirectional Endpoint**: `http://<host>:<port>/mcp`

### Transport Mode Comparison

|Feature|SSE Transport|Streamable HTTP|
|---|---|---|
|Endpoint Architecture|Dual endpoints \(GET stream \+ POST message\)|Single unified bidirectional endpoint|
|Communication Mode|Unidirectional server\-to\-client streaming|Full bidirectional streaming \& standard HTTP response|
|Connection Stability|Prone to session inconsistency|Auto session recovery, high concurrency optimized|
|Specification Status|Legacy compatible|Latest official MCP standard|

## Client Configuration Example

### MCP Client JSON Config \(Cursor / Claude Desktop\)

```json
{
  "mcpServers": {
    "fsext": {
      "command": "fsext-mcp-server",
      "args": [],
      "env": {}
    }
  }
}
```

## Unified Global Response Specification

All MCP tools adopt a consistent top\-level response structure for both success and failure scenarios, enabling universal client parsing logic\.

### General Structure

```json
{
  "res": {
    "success": boolean,
    "info": object
  }
}
```

### Success Response

`success: true` \- The `info` field carries tool\-specific business data\.

### Error Response \(Unified Standard\)

`success: false` \- All errors \(IO failure, invalid params, path error, runtime exception\) return fixed error structure:

```json
{
  "res": {
    "success": false,
    "info": {
      "code": "ERROR_CODE",
      "message": "Human-readable detailed error message"
    }
  }
}
```

## Full MCP Tools Reference

All tools enable `additionalProperties: false` strict validation to reject illegal input parameters, ensuring invocation safety\.

### 1\. Directory Operation Tools

#### fs\_list\_directory

**Description**: Scan target directory, return filtered absolute path list, support recursive traversal, pure file filtering, and suffix filtering\.

**Parameters**:

- `source_dir` \(string, required\): Target directory path for scanning

- `recursive` \(boolean, required\): Enable recursive subdirectory scanning

- `only_files` \(boolean, required\): Return only files, exclude directories

- `file_extension` \(string, optional, default=""\): Filter files by specified suffix

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "paths": ["/absolute/path/file1.txt", "/absolute/path/file2.js"]
    }
  }
}
```

#### fs\_copy\_directory

**Description**: Recursively copy full directory tree, support overwriting existing target directories\.

**Parameters**:

- `source_dir` \(string, required\): Source directory path

- `copy_dest_dir` \(string, required\): Target directory path

- `overwrite` \(boolean, optional, default=false\): Clean and overwrite existing target directory

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {}
  }
}
```

#### fs\_move\_directory

**Description**: Move entire directory tree, fail fast if target path exists to prevent accidental overwriting\.

**Parameters**:

- `source_dir` \(string, required\): Source directory path

- `dest_dir` \(string, required\): Target directory path

- `overwrite` \(boolean, optional, default=false\): Allow overwriting conflicting directory

**Success Response**: Empty info object with success flag

### 2\. File Basic Operation Tools

#### fs\_create\_file

**Description**: Create empty or content\-filled file, auto\-create missing parent directories, support multi\-encoding\.

**Parameters**:

- `file_path` \(string, required\): Target file path

- `content` \(string, optional, default=""\): Initial text content

- `charset` \(string, optional, default=utf\-8\): Encoding enum: utf\-8, ucs\-2, utf16le, latin1, ascii, base64, hex

**Success Response**: Empty info object with success flag

#### fs\_delete\_file

**Description**: Delete single regular file only; reject directory paths to avoid batch deletion risks\.

**Parameters**:

- `file_path` \(string, required\): Target file path

**Success Response**: Empty info object with success flag

#### fs\_copy\_file

**Description**: Copy single file with complete metadata retention, support overwrite control\.

**Parameters**:

- `source_file_path` \(string, required\): Source file path

- `dest_file_path` \(string, required\): Target file path

- `overwrite` \(boolean, optional, default=false\): Overwrite existing target file

**Success Response**: Empty info object with success flag

#### fs\_move\_file

**Description**: Move single file with configurable overwrite behavior\.

**Parameters**:

- `source_file_path` \(string, required\): Source file path

- `dest_file_path` \(string, required\): Target file path

- `overwrite` \(boolean, optional, default=false\): Overwrite conflicting file

**Success Response**: Empty info object with success flag

#### fs\_get\_file\_info

**Description**: Obtain full metadata of file/directory, support optional SHA\-256 digest calculation\.

**Parameters**:

- `file_path` \(string, required\): Target entry path

- `calc_digest` \(boolean, optional, default=false\): Calculate SHA\-256 hash

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "absolute_path": "string",
      "is_readable": true,
      "is_writable": true,
      "size": 1672,
      "is_regular_file": true,
      "is_directory": false,
      "is_symbolic_link": false,
      "creation_millis": 1782288135574,
      "last_modified_millis": 1782279393020,
      "last_access_millis": 1782644004556,
      "sha256_digest": "calculated-hash-string"
    }
  }
}
```

#### fs\_is\_file\_exists

**Description**: Lightweight existence check for file or directory\.

**Parameters**:

- `file_path` \(string, required\): Target path

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "exists": true
    }
  }
}
```

### 3\. File Read \& Write Tools

#### fs\_read\_full\_text

**Description**: Read full text content of target file with specified encoding\.

**Parameters**:

- `file_path` \(string, required\): Target file path

- `charset` \(string, optional, default=utf\-8\): Multi encoding support

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "content": "full-text-file-content"
    }
  }
}
```

#### fs\_read\_text\_range

**Description**: Segmented text reading for large files, support skip leading lines and limit read lines\.

**Parameters**:

- `file_path` \(string, required\): Target file path

- `lines_to_skip` \(integer, required\): Number of leading lines to skip

- `max_lines_to_read` \(integer, required\): Maximum lines to read

- `line_separator` \(string, optional, default="\\n"\): Line break character

- `charset` \(string, optional, default=utf\-8\): File encoding

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "lines_count": 5,
      "content": "segmented-text-content"
    }
  }
}
```

#### fs\_read\_binary\_chunk

**Description**: Chunked binary file reading, return Base64 encoded data for safe network transmission, support stream end detection\.

**Parameters**:

- `file_path` \(string, required\): Target file path

- `bytes_to_skip` \(integer, required\): Leading bytes to skip

- `max_bytes_to_read` \(integer, required\): Maximum bytes to read

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "data_base64": "base64-encoded-binary",
      "raw_bytes_length": 5,
      "end_of_stream": true
    }
  }
}
```

#### fs\_write\_text

**Description**: Write text content to file, support overwrite or append mode\.

**Parameters**:

- `file_path` \(string, required\): Target file path

- `text` \(string, required, minLength=1\): Text content to write

- `append` \(boolean, optional, default=false\): Append mode switch

- `charset` \(string, optional, default=utf\-8\): File encoding

**Success Response**: Empty info object with success flag

#### fs\_write\_binary

**Description**: Write Base64 decoded binary data to file, support append operation\.

**Parameters**:

- `file_path` \(string, required\): Target file path

- `base64_data` \(string, required, minLength=1\): Base64 encoded binary data

- `append` \(boolean, optional, default=false\): Append mode switch

**Success Response**: Empty info object with success flag

### 4\. Search \& Replace Tools

#### fs\_search\_files\_by\_content

**Description**: Recursively scan directory, return all file paths containing target content, support regex, case ignore, suffix filter\.

**Parameters**:

- `dir_path` \(string, required\): Scan root directory

- `recursive` \(boolean, required\): Recursive scan enable

- `search_term` \(string, required\): Search keyword or regex pattern

- `is_regex` \(boolean, optional, default=false\): Regex matching enable

- `ignore_case` \(boolean, optional, default=true\): Case\-insensitive matching

- `file_extension` \(string, optional, default=""\): File suffix filter

- `charset` \(string, optional, default=utf\-8\): File encoding

#### fs\_search\_in\_files\_by\_content

**Description**: Multi\-file content matching, return structured results with customizable context lines and result limit\.

**Parameters**:

- `dir_path` \(string, required\): Scan root directory

- `recursive` \(boolean, required\): Recursive scan enable

- `search_term` \(string, required\): Search keyword/regex

- `limit` \(integer, required\): Max matching result count

- `is_regex` \(boolean, optional, default=false\): Regex enable

- `ignore_case` \(boolean, optional, default=true\): Case ignore

- `lines_before` \(integer, optional, default=0\): Preceding context lines

- `lines_after` \(integer, optional, default=0\): Subsequent context lines

- `file_extension` \(string, optional, default=""\): Suffix filter

- `charset` \(string, optional, default=utf\-8\): File encoding

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "results": [
        {
          "file_path": "/test/file.ts",
          "start_line": 1,
          "end_line": 1,
          "text": "matched-content-line"
        }
      ]
    }
  }
}
```

#### fs\_search\_in\_file\_by\_content

**Description**: Precise single\-file content search with line context preview\.

**Parameters**: Similar to multi\-file search, single file path input

**Success Response**: Structured single\-file matching results

#### fs\_file\_replace

**Description**: In\-place text replacement in single file, return total replaced count\.

**Parameters**:

- `file_path` \(string, required\): Target file path

- `search_term` \(string, required\): Text to replace

- `replacement` \(string, required\): New replacement text

- `line_separator` \(string, optional, default="\\n"\): Line break separator

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "count": 1
    }
  }
}
```

### 5\. Image Processing Tools

#### fs\_image\_resize

**Description**: Resize image with aspect ratio lock support, generate new output image file\.

**Parameters**:

- `source_path` \(string, required\): Source image path

- `dest_path` \(string, required\): Output image path

- `width` \(integer, required, \>0\): Target width

- `height` \(integer, required, \>0\): Target height

- `keep_aspect_ratio` \(boolean, optional, default=true\): Lock original aspect ratio

**Success Response**: Empty info object with success flag

#### fs\_image\_crop

**Description**: Crop specified rectangular region from source image and export new file\.

**Parameters**:

- `source_path` \(string, required\): Source image path

- `dest_path` \(string, required\): Output image path

- `x` \(integer, required, ≥0\): Crop start X coordinate

- `y` \(integer, required, ≥0\): Crop start Y coordinate

- `width` \(integer, required, \>0\): Crop region width

- `height` \(integer, required, \>0\): Crop region height

**Success Response**: Empty info object with success flag

#### fs\_image\_rotate

**Description**: Rotate image clockwise by arbitrary degrees, auto expand canvas to preserve full content\.

**Parameters**:

- `source_path` \(string, required\): Source image path

- `dest_path` \(string, required\): Output image path

- `degrees` \(number, required\): Clockwise rotation angle

**Success Response**: Empty info object with success flag

### 6\. OCR Tool

#### fs\_ocr\_extract\_text

**Description**: Extract text from images via Tesseract OCR, support WASM runtime \(no local engine\) and custom local binary path\.

**Parameters**:

- `image_path` \(string, required\): Target image path

- `tesseract_bin_path` \(string, optional, default=""\): Custom Tesseract executable path

- `tessdata_path` \(string, optional, default=""\): Custom tessdata language resource path

- `lang` \(string, optional, default eng\): Recognition language prefix

**Success Response**:

```json
{
  "res": {
    "success": true,
    "info": {
      "content": "extracted-ocr-text-content"
    }
  }
}
```

## Project Build \& Development

### Scripts

```bash
# Clean build artifacts
npm run clean

# Compile TypeScript source
npm run build

# Watch mode for development
npm run dev

# Full rebuild (clean + build)
npm run rebuild

# Start SSE transport server
npm run server

# FastMCP dev mode
npm run fastmcp

# MCP Inspector debugging
npm run inspect

# Build and run test cases
npm run test
```

## Dependencies

### Core Runtime Dependencies

- **fastmcp**: Official MCP server runtime framework

- **sharp**: High\-performance image processing engine

- **tesseract\.js**: WASM\-based cross\-platform OCR engine

- **winston**: Standard logging system

- **zod**: Strict schema validation for tool parameters

- **chardet / iconv\-lite**: Multi\-encoding detection and conversion

- **cors**: Cross\-origin resource sharing support for HTTP transport

- **minimist**: CLI parameter parsing

## License

This project is open\-sourced under the **Apache License 2\.0**\. See the `LICENSE` file in the project root for full license details\.

## Repository \& Issues

- **GitHub**: [https://github\.com/kurtzhi/fsext\-mcp\-server\-typescript](https://github.com/kurtzhi/fsext-mcp-server-typescript)

- **Issues**: [Report bugs or request features](https://github.com/kurtzhi/fsext-mcp-server-typescript/issues)