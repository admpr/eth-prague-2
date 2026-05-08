
import { alpha4, rgb565 } from "./color.js"
import {
    FORMAT_ALPHA, FORMAT_RGB565, VERSION_TAG,
    getPixels
} from "./image.js";

import type { JimpInstance } from "jimp";

import type { RGBA } from "./color.js";
import type { Image } from "./image.js";

export class ImageRGBA implements Image {
    readonly width: number;
    readonly height: number;

    #pixels: Array<RGBA>;

    constructor(width: number, height: number, pixels: Array<RGBA>) {
        if (pixels.length !== width * height) {
            throw new Error("invalid data length for rgb");
        }

        this.width = width;
        this.height = height;
        this.#pixels = pixels;
    }

    _addSize(data: Array<number>): void {
        data.push(this.width >> 8);
        data.push(this.width & 0xff);
        data.push(this.height >> 8);
        data.push(this.height & 0xff);
    }

    _addAlpha(data: Array<number>): void {

        // Add a dummy entry on the end in case we're odd-length
        const pixels = this.#pixels.slice();
        while ((pixels.length % 4) !== 0) {
            pixels.push({ r: 0, g: 0, b: 0, a: 0 });
        }

        const skip = pixels.length / 4;

        data.push(skip >> 8);
        data.push(skip & 0xff);
        console.log(`// SKIP: ${ skip }`);

        for (let i = 0; i < pixels.length; i += 2) {
            const a = alpha4(pixels[i].a), b = alpha4(pixels[i + 1].a);
            data.push((a << 4) | b);
        }
    }

    _addRgb(data: Array<number>): void {
        for (let i = 0; i < this.#pixels.length; i++) {
            const [ a, b ] = rgb565(this.#pixels[i]);
            data.push(a);
            data.push(b);
        }
    }


    get bytes(): Uint8Array {
        const data = [ VERSION_TAG, FORMAT_RGB565 | FORMAT_ALPHA ];

        this._addSize(data);
        this._addAlpha(data);
        this._addRgb(data);

        return new Uint8Array(data);
    }

    static fromImage(jimp: JimpInstance) {
        const { width, height, pixels } = getPixels(jimp);
        return new this(width, height, pixels);
    }
}

export class ImageRGB extends ImageRGBA {
    get bytes(): Uint8Array {
        const data = [ VERSION_TAG, FORMAT_RGB565 ];

        this._addSize(data);
        this._addRgb(data);

        return new Uint8Array(data);
    }
}
