import { rgb565 } from "./color.js";
import {
    VERSION_TAG, FORMAT_PALETTE8,
    getPixels
} from "./image.js";

import type { JimpInstance } from "jimp";
import type { Image } from "./image.js";

export class ImagePalette implements Image {
    readonly width: number;
    readonly height: number;

    readonly #palette: Array<number>;
    readonly #indices: Uint8Array;

    constructor(width: number, height: number, palette: Array<number>, indices: Array<number>) {
        this.width = width;
        this.height = height;

        if (palette.length > 256) { throw new Error(`palette too large`); }

        // Pad up to the next power-of-two
        palette = palette.slice();
        while (palette.length & (palette.length - 1)) {
            palette.push(0);
        }

        this.#palette = palette;
        this.#indices = new Uint8Array(indices);
    }

    _addSize(data: Array<number>): void {
        data.push(this.width >> 8);
        data.push(this.width & 0xff);
        data.push(this.height >> 8);
        data.push(this.height & 0xff);
    }

    _addPalette(data: Array<number>): void {
        this.#palette.forEach((c) => {
            data.push((c >> 8) & 0xff);
            data.push(c & 0xff);
        });
    }

    _addPixels(data: Array<number>): void {
        const indices = this.#indices;
        for (let i = 0; i < indices.length; i++) {
            data.push(indices[i]);
        }
    }

    get bytes(): Uint8Array {
        const data = [ VERSION_TAG ];

        switch (this.#palette.length) {
            case 256:
                data.push(FORMAT_PALETTE8);
                break;
            default:
                throw new Error(`unsupported palette depth: ${ this.#palette.length }`);
        }

        this._addSize(data);
        this._addPalette(data);
        this._addPixels(data);

        return new Uint8Array(data);
    }

    static fromImage(jimp: JimpInstance): ImagePalette {
        const { width, height, pixels } = getPixels(jimp);

        const palette: Array<number> = [ ];
        const indices: Array<number> = [ ];

        for (const color of pixels) {
            const _c = rgb565(color);
            const c = (_c[0] << 8) | _c[1];

            let index = palette.indexOf(c);
            if (index === -1) {
                index = palette.length;
                palette.push(c);
            }
            indices.push(index);
        }

        if (palette.length > 255) {
            jimp = <JimpInstance>(jimp.quantize({ colors: 255 }));
            return ImagePalette.fromImage(jimp);
        }

        return new this(width, height, palette, indices);
    }
}
