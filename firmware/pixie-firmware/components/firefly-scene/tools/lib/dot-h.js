function zpad(v, length) {
    if (length == null) {
        length = 2;
    }
    while (v.length < length) {
        v = "0" + v;
    }
    return v;
}
export function toDotH(data, tag) {
    if (data.length % 2) {
        throw new Error("data must be uint16_t; event length");
    }
    const output = [];
    output.push(`#ifndef __IMAGE_${tag}_H__`);
    output.push(`#define __IMAGE_${tag}_H__`);
    output.push("");
    output.push("#ifdef __cplusplus");
    output.push("extern \"C\" {");
    output.push("#endif  /* __cplusplus */");
    output.push("#include <stdint.h>");
    output.push("");
    output.push(`const uint16_t image_${tag}[] = {`);
    let offset = 0;
    while (offset < data.length) {
        const line = [];
        while (offset < data.length && line.length < 8) {
            const a = data[offset].toString(16);
            const b = data[offset + 1].toString(16);
            offset += 2;
            line.push(`0x${zpad(a)}${zpad(b)}`);
        }
        output.push("  " + line.join(", ") + ",");
    }
    output.push("};");
    output.push("");
    output.push("#ifdef __cplusplus");
    output.push("}");
    output.push("#endif  /* __cplusplus */");
    output.push("");
    output.push(`#endif  /* __IMAGE_${tag}_H__ */`);
    return output.join("\n");
}
//# sourceMappingURL=dot-h.js.map