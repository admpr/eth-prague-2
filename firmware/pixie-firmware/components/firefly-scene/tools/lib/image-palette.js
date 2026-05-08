var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ImagePalette_palette, _ImagePalette_indices;
import { rgb565 } from "./color.js";
import { VERSION_TAG, FORMAT_PALETTE8, getPixels } from "./image.js";
export class ImagePalette {
    constructor(width, height, palette, indices) {
        _ImagePalette_palette.set(this, void 0);
        _ImagePalette_indices.set(this, void 0);
        this.width = width;
        this.height = height;
        if (palette.length > 256) {
            throw new Error(`palette too large`);
        }
        // Pad up to the next power-of-two
        palette = palette.slice();
        while (palette.length & (palette.length - 1)) {
            palette.push(0);
        }
        __classPrivateFieldSet(this, _ImagePalette_palette, palette, "f");
        __classPrivateFieldSet(this, _ImagePalette_indices, new Uint8Array(indices), "f");
    }
    _addSize(data) {
        data.push(this.width >> 8);
        data.push(this.width & 0xff);
        data.push(this.height >> 8);
        data.push(this.height & 0xff);
    }
    _addPalette(data) {
        __classPrivateFieldGet(this, _ImagePalette_palette, "f").forEach((c) => {
            data.push((c >> 8) & 0xff);
            data.push(c & 0xff);
        });
    }
    _addPixels(data) {
        const indices = __classPrivateFieldGet(this, _ImagePalette_indices, "f");
        for (let i = 0; i < indices.length; i++) {
            data.push(indices[i]);
        }
    }
    get bytes() {
        const data = [VERSION_TAG];
        switch (__classPrivateFieldGet(this, _ImagePalette_palette, "f").length) {
            case 256:
                data.push(FORMAT_PALETTE8);
                break;
            default:
                throw new Error(`unsupported palette depth: ${__classPrivateFieldGet(this, _ImagePalette_palette, "f").length}`);
        }
        this._addSize(data);
        this._addPalette(data);
        this._addPixels(data);
        return new Uint8Array(data);
    }
    static fromImage(jimp) {
        const { width, height, pixels } = getPixels(jimp);
        const palette = [];
        const indices = [];
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
            jimp = (jimp.quantize({ colors: 255 }));
            return ImagePalette.fromImage(jimp);
        }
        return new this(width, height, palette, indices);
    }
}
_ImagePalette_palette = new WeakMap(), _ImagePalette_indices = new WeakMap();
//# sourceMappingURL=image-palette.js.map