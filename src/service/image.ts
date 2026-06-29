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
 * Service for image-related operations, including mime detection, resize, crop and rotation.
 * All file path arguments are validated via unified check_utils utilities.
 */

import sharp from 'sharp';

import * as check from './check.utils.js';


/**
 * Resize source image and output to target path, support proportional scaling.
 * @param sourceImagePath The path to the source image.
 * @param destImagePath The path to save the resized image.
 * @param width Expected output pixel width.
 * @param height Expected output pixel height.
 * @param keepAspectRatio If true, automatically calculate scale to avoid stretching.
 * @returns Resolve after image file written completely.
 */
export async function resize(
    sourceImagePath: string,
    destImagePath: string,
    width: number,
    height: number,
    keepAspectRatio: boolean = true
): Promise<void> {
    check.requireNonBlank(sourceImagePath, 'sourceImagePath');
    await check.requireReadableFile(sourceImagePath, 'sourceImagePath');
    check.requireNonBlank(destImagePath, 'destImagePath');
    await check.requireWritableParentDirectory(destImagePath, 'destImagePath');
    if (width <= 0 || height <= 0) {
        throw new Error(`width and height must be greater than 0`);
    }

    const image = sharp(sourceImagePath);
    const metadata = await image.metadata();

    let dstWidth = width;
    let dstHeight = height;

    if (keepAspectRatio && metadata.width && metadata.height) {
        const scaleX = width / metadata.width;
        const scaleY = height / metadata.height;
        const scale = Math.min(scaleX, scaleY);
        dstWidth = Math.round(metadata.width * scale);
        dstHeight = Math.round(metadata.height * scale);
    }

    await image.resize(dstWidth, dstHeight).toFile(destImagePath);
}

/**
 * Crop rectangular area from source image and export new file.
 * @param sourceImagePath The path to the source image.
 * @param destImagePath The path to save the cropped image.
 * @param x Left offset coordinate of crop region.
 * @param y Top offset coordinate of crop region.
 * @param width Crop region pixel width.
 * @param height Crop region pixel height.
 * @returns Resolve after cropped image saved.
 */
export async function crop(
    sourceImagePath: string,
    destImagePath: string,
    x: number,
    y: number,
    width: number,
    height: number
): Promise<void> {
    check.requireNonBlank(sourceImagePath, 'sourceImagePath');
    await check.requireReadableFile(sourceImagePath, 'sourceImagePath');
    check.requireNonBlank(destImagePath, 'destImagePath');
    await check.requireWritableParentDirectory(destImagePath, 'destImagePath');
    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
        throw new Error(`x, y, width and height must be greater than 0`);
    }

    await sharp(sourceImagePath)
        .extract({left: x, top: y, width, height})
        .toFile(destImagePath);
}

/**
 * Rotate image by specified angle and write output file.
 * @param sourceImagePath The path to the source image.
 * @param destImagePath The path to save the rotated image.
 * @param degrees Rotation angle in degrees.
 * @returns Resolve once rotation & file write finished.
 */
export async function rotateImage(
    sourceImagePath: string,
    destImagePath: string,
    degrees: number
): Promise<void> {
    check.requireNonBlank(sourceImagePath, 'sourceImagePath');
    await check.requireReadableFile(sourceImagePath, 'sourceImagePath');
    check.requireNonBlank(destImagePath, 'destImagePath');
    await check.requireWritableParentDirectory(destImagePath, 'destImagePath');

    degrees = degrees % 360;

    await sharp(sourceImagePath)
        .rotate(degrees)
        .toFile(destImagePath);
}