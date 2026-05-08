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
var _ImageRGBA_pixels;
import { alpha4, rgb565 } from "./color.js";
import { FORMAT_ALPHA, FORMAT_RGB565, VERSION_TAG, getPixels } from "./image.js";
export class ImageRGBA {
    constructor(width, height, pixels) {
        _ImageRGBA_pixels.set(this, void 0);
        if (pixels.length !== width * height) {
            throw new Error("invalid data length for rgb");
        }
        this.width = width;
        this.height = height;
        __classPrivateFieldSet(this, _ImageRGBA_pixels, pixels, "f");
    }
    _addSize(data) {
        data.push(this.width >> 8);
        data.push(this.width & 0xff);
        data.push(this.height >> 8);
        data.push(this.height & 0xff);
    }
    _addAlpha(data) {
        // Add a dummy entry on the end in case we're odd-length
        const pixels = __classPrivateFieldGet(this, _ImageRGBA_pixels, "f").slice();
        while ((pixels.length % 4) !== 0) {
            pixels.push({ r: 0, g: 0, b: 0, a: 0 });
        }
        const skip = pixels.length / 4;
        data.push(skip >> 8);
        data.push(skip & 0xff);
        console.log(`// SKIP: ${skip}`);
        for (let i = 0; i < pixels.length; i += 2) {
            const a = alpha4(pixels[i].a), b = alpha4(pixels[i + 1].a);
            data.push((a << 4) | b);
        }
    }
    _addRgb(data) {
        for (let i = 0; i < __classPrivateFieldGet(this, _ImageRGBA_pixels, "f").length; i++) {
            const [a, b] = rgb565(__classPrivateFieldGet(this, _ImageRGBA_pixels, "f")[i]);
            data.push(a);
            data.push(b);
        }
    }
    get bytes() {
        const data = [VERSION_TAG, FORMAT_RGB565 | FORMAT_ALPHA];
        this._addSize(data);
        this._addAlpha(data);
        this._addRgb(data);
        return new Uint8Array(data);
    }
    static fromImage(jimp) {
        const { width, height, pixels } = getPixels(jimp);
        return new this(width, height, pixels);
    }
}
_ImageRGBA_pixels = new WeakMap();
export class ImageRGB extends ImageRGBA {
    get bytes() {
        const data = [VERSION_TAG, FORMAT_RGB565];
        this._addSize(data);
        this._addRgb(data);
        return new Uint8Array(data);
    }
}
//# sourceMappingURL=image-rgb.js.map