type CborValue =
  | Uint8Array
  | CborValue[]
  | null
  | boolean
  | number
  | string
  | { [key: string]: CborValue };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function beBytes(value: number): number[] {
  const bytes: number[] = [];
  while (value) {
    bytes.unshift(value & 0xff);
    value = Math.trunc(value / 256);
  }
  return bytes;
}

function header(type: number, value: number): number[] {
  if (value < 24) {
    return [(type << 5) | value];
  }

  const bytes = beBytes(value);
  while (bytes.length & (bytes.length - 1)) {
    bytes.unshift(0);
  }

  const marker = ({ 1: 24, 2: 25, 4: 26, 8: 27 } as Record<number, number>)[bytes.length];
  if (marker == null) {
    throw new Error("CBOR value out of range");
  }

  return [(type << 5) | marker, ...bytes];
}

function encodeInner(value: CborValue): number[] {
  if (value instanceof Uint8Array) {
    return [...header(2, value.length), ...value];
  }

  if (Array.isArray(value)) {
    return [...header(4, value.length), ...value.flatMap(encodeInner)];
  }

  if (value === null) {
    return [(7 << 5) | 22];
  }

  switch (typeof value) {
    case "boolean":
      return [(7 << 5) | (value ? 21 : 20)];
    case "number":
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error("CBOR only supports non-negative safe integers here");
      }
      return header(0, value);
    case "string": {
      const bytes = textEncoder.encode(value);
      return [...header(3, bytes.length), ...bytes];
    }
    case "object":
      return [
        ...header(5, Object.keys(value).length),
        ...Object.entries(value).flatMap(([key, entry]) => [
          ...encodeInner(key),
          ...encodeInner(entry),
        ]),
      ];
    default:
      throw new Error("Unsupported CBOR value");
  }
}

function readLength(bytes: Uint8Array, initial: number, offset: number): { value: number; offset: number } {
  if (initial < 24) {
    return { value: initial, offset };
  }
  if (initial > 27) {
    throw new Error("Invalid CBOR length marker");
  }

  const length = 1 << (initial - 24);
  let value = 0;
  for (let i = 0; i < length; i++) {
    value = value * 256 + bytes[offset + i];
  }
  return { value, offset: offset + length };
}

function decodeInner(bytes: Uint8Array, offset: number): { value: CborValue; offset: number } {
  const head = bytes[offset++];
  const type = head >> 5;
  const initial = head & 0x1f;

  if (type === 7) {
    if (initial === 20) return { value: false, offset };
    if (initial === 21) return { value: true, offset };
    if (initial === 22) return { value: null, offset };
    throw new Error("Unsupported CBOR simple value");
  }

  const length = readLength(bytes, initial, offset);
  offset = length.offset;

  switch (type) {
    case 0:
      return { value: length.value, offset };
    case 2: {
      const value = bytes.slice(offset, offset + length.value);
      return { value, offset: offset + length.value };
    }
    case 3: {
      const value = textDecoder.decode(bytes.slice(offset, offset + length.value));
      return { value, offset: offset + length.value };
    }
    case 4: {
      const value: CborValue[] = [];
      for (let i = 0; i < length.value; i++) {
        const item = decodeInner(bytes, offset);
        value.push(item.value);
        offset = item.offset;
      }
      return { value, offset };
    }
    case 5: {
      const value: Record<string, CborValue> = {};
      for (let i = 0; i < length.value; i++) {
        const key = decodeInner(bytes, offset);
        offset = key.offset;
        if (typeof key.value !== "string") {
          throw new Error("CBOR map keys must be strings");
        }
        const entry = decodeInner(bytes, offset);
        value[key.value] = entry.value;
        offset = entry.offset;
      }
      return { value, offset };
    }
    default:
      throw new Error("Unsupported CBOR major type");
  }
}

export function encodeCbor(value: CborValue): Uint8Array {
  return new Uint8Array(encodeInner(value));
}

export function decodeCbor(bytes: Uint8Array): CborValue {
  const decoded = decodeInner(bytes, 0);
  if (decoded.offset !== bytes.length) {
    throw new Error("Trailing CBOR data");
  }
  return decoded.value;
}

export type { CborValue };
