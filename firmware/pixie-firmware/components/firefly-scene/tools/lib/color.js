function clamp(value, maxValue) {
    let result = Math.round(value * maxValue / 255);
    if (result > maxValue) {
        result = maxValue;
    }
    return result;
}
export function alpha4(a) {
    return clamp(a, 15);
}
export function rgb565(c) {
    const r = clamp(c.r, 31);
    const g = clamp(c.g, 63);
    const b = clamp(c.b, 31);
    return [((r << 3) | (g >> 3)) & 0xff, ((g << 5) | b) & 0xff];
    //return [ ((r & 0x78) | (g >> 5)), (((g & 0xfc) << 3) | (b >> 3)) ];
}
//# sourceMappingURL=color.js.map