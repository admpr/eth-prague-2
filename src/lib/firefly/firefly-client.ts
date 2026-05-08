import { decodeCbor, encodeCbor, type CborValue } from "./cbor";
import { bytesToHex } from "./hex";

const uuidSvcFsp = 0xabf0;
const uuidChrFspContent = 0xabf1;
const uuidChrFspLogger = 0xabf2;

const CMD_RESET = 0x02;
const CMD_QUERY = 0x03;
const CMD_START_MESSAGE = 0x06;
const CMD_CONTINUE_MESSAGE = 0x07;

const STATUS_OK = 0x00;
const ERROR_MASK = 0x80;
const ERROR_UNSUPPORTED_VERSION = 0x81;
const ERROR_BAD_COMMAND = 0x82;
const ERROR_BUFFER_OVERRUN = 0x84;
const ERROR_MISSING_MESSAGE = 0x85;
const ERROR_BAD_CHECKSUM = 0x86;
const ERROR_UNKNOWN = 0x8f;
const ERROR_BUSY = 0x91;

const CHUNK_SIZE = 506;
let nextMessageId = 1;

type FireflyQuery = {
  version: number;
  offset: number;
  length: number;
  model: number;
  serial: number;
};

type PendingReply = {
  resolve: (value: CborValue) => void;
  reject: (reason: Error) => void;
  timeout: number;
};

function eventBytes(event: Event): Uint8Array {
  const target = event.target as BluetoothRemoteGATTCharacteristic;
  if (!target.value) {
    return new Uint8Array();
  }
  return new Uint8Array(target.value.buffer, target.value.byteOffset, target.value.byteLength);
}

function toNumber(bytes: Uint8Array): number {
  return bytes.reduce((value, byte) => value * 256 + byte, 0);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const result = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(result).set(bytes);
  return result;
}

function fireflyProtocolError(status: number): Error {
  switch (status) {
    case ERROR_UNSUPPORTED_VERSION:
      return new Error("Unsupported hardware wallet protocol version");
    case ERROR_BAD_COMMAND:
      return new Error("Hardware wallet rejected an unknown command");
    case ERROR_BUFFER_OVERRUN:
      return new Error("Hardware wallet message buffer overrun");
    case ERROR_MISSING_MESSAGE:
      return new Error("Hardware wallet is missing a message chunk");
    case ERROR_BAD_CHECKSUM:
      return new Error("Hardware wallet reported a bad message checksum");
    case ERROR_BUSY:
      return new Error("Hardware wallet is busy");
    case ERROR_UNKNOWN:
      return new Error("Hardware wallet reported an unknown error");
    default:
      return new Error(`Hardware wallet protocol error 0x${status.toString(16)}`);
  }
}

export class FireflyClient {
  readonly device: BluetoothDevice;
  readonly server: BluetoothRemoteGATTServer;
  readonly content: BluetoothRemoteGATTCharacteristic;
  readonly logger: BluetoothRemoteGATTCharacteristic;

  private readBuffer: Uint8Array[] = [];
  private destroyCallbacks: Array<() => Promise<void>> = [];
  private serial: Promise<void> = Promise.resolve();
  private queryCache?: FireflyQuery;
  private pendingReplies = new Map<number, PendingReply>();
  private incoming = {
    data: new Uint8Array(1 << 14),
    offset: 0,
    length: 0,
  };

  ondisconnect?: () => void;
  onmessage?: (message: CborValue) => void;
  onlog?: (message: string) => void;

  private constructor(
    device: BluetoothDevice,
    server: BluetoothRemoteGATTServer,
    content: BluetoothRemoteGATTCharacteristic,
    logger: BluetoothRemoteGATTCharacteristic,
  ) {
    this.device = device;
    this.server = server;
    this.content = content;
    this.logger = logger;
  }

  get serialNumber(): number {
    if (!this.queryCache) throw new Error("Hardware wallet query not loaded");
    return this.queryCache.serial;
  }

  get modelNumber(): number {
    if (!this.queryCache) throw new Error("Hardware wallet query not loaded");
    return this.queryCache.model;
  }

  get model(): string {
    const model = this.modelNumber;
    if ((model >> 8) === 1) {
      return `Hardware wallet (rev: ${model & 0xff})`;
    }
    return `Unknown hardware wallet 0x${model.toString(16)}`;
  }

  async sendMessage(method: string, params: CborValue): Promise<CborValue> {
    const message = { v: 1, method, id: nextMessageId++, params };
    const promise = new Promise<CborValue>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pendingReplies.delete(message.id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, 60_000);
      this.pendingReplies.set(message.id, { resolve, reject, timeout });
    });

    await this.chunkAndSendMessage(encodeCbor(message));
    return promise;
  }

  async destroy(): Promise<void> {
    for (const callback of this.destroyCallbacks.splice(0)) {
      await callback();
    }
    for (const pending of this.pendingReplies.values()) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error("Hardware wallet disconnected"));
    }
    this.pendingReplies.clear();
  }

  async forget(): Promise<void> {
    await this.device.forget?.();
  }

  static async discover(forceRequest = false): Promise<FireflyClient> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not available in this browser");
    }

    const pairedDevices = navigator.bluetooth.getDevices ? await navigator.bluetooth.getDevices() : [];
    const device =
      pairedDevices.length > 0 && !forceRequest
        ? pairedDevices[0]
        : await navigator.bluetooth.requestDevice({
            filters: [{ services: [uuidSvcFsp] }],
            optionalServices: ["battery_service", uuidSvcFsp],
          });

    if (!device.gatt) {
      throw new Error("Selected Bluetooth device has no GATT server");
    }

    const server = await device.gatt.connect();
    const fsp = await server.getPrimaryService(uuidSvcFsp);
    const content = await fsp.getCharacteristic(uuidChrFspContent);
    const logger = await fsp.getCharacteristic(uuidChrFspLogger);
    const firefly = new FireflyClient(device, server, content, logger);
    await firefly.start();

    const query = await firefly.query();
    if (query.version !== 0x01) {
      throw new Error(`Unsupported hardware wallet protocol version ${query.version}`);
    }
    if (query.length) {
      await firefly.reset();
    }

    return firefly;
  }

  private async start(): Promise<void> {
    const disconnectListener = () => this.ondisconnect?.();
    this.device.addEventListener("gattserverdisconnected", disconnectListener);
    this.destroyCallbacks.push(async () => {
      this.device.removeEventListener("gattserverdisconnected", disconnectListener);
    });

    const contentListener = (event: Event) => this.handleContent(eventBytes(event));
    this.content.addEventListener("characteristicvaluechanged", contentListener);
    await this.content.startNotifications();
    this.destroyCallbacks.push(async () => {
      this.content.removeEventListener("characteristicvaluechanged", contentListener);
      await this.content.stopNotifications().catch(() => undefined);
    });

    const loggerListener = (event: Event) => {
      this.onlog?.(new TextDecoder().decode(eventBytes(event)));
    };
    this.logger.addEventListener("characteristicvaluechanged", loggerListener);
    await this.logger.startNotifications();
    this.destroyCallbacks.push(async () => {
      this.logger.removeEventListener("characteristicvaluechanged", loggerListener);
      await this.logger.stopNotifications().catch(() => undefined);
    });

    this.destroyCallbacks.push(async () => {
      this.server.disconnect();
    });
  }

  private handleContent(data: Uint8Array): void {
    if (data.length === 0) {
      return;
    }

    const status = data[0];
    if (status === STATUS_OK || status & ERROR_MASK) {
      this.readBuffer.push(data);
      return;
    }

    if (status === CMD_QUERY) {
      void this.write(new Uint8Array([STATUS_OK, CMD_QUERY, 0x01, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff]));
      return;
    }

    if (status === CMD_RESET) {
      this.incoming.offset = 0;
      this.incoming.length = 0;
      return;
    }

    if (status === CMD_START_MESSAGE) {
      this.incoming.length = (data[1] << 8) | data[2];
      this.incoming.data.set(data.slice(3), 0);
      this.incoming.offset = data.length - 3;
      void this.processIncomingIfComplete();
      return;
    }

    if (status === CMD_CONTINUE_MESSAGE) {
      const expectedOffset = (data[1] << 8) | data[2];
      if (expectedOffset !== this.incoming.offset) {
        this.rejectAll(new Error("Hardware wallet message chunks arrived out of order"));
        return;
      }
      this.incoming.data.set(data.slice(3), this.incoming.offset);
      this.incoming.offset += data.length - 3;
      void this.processIncomingIfComplete();
    }
  }

  private async processIncomingIfComplete(): Promise<void> {
    if (this.incoming.offset !== this.incoming.length) {
      return;
    }

    const payload = this.incoming.data.slice(32, this.incoming.length);
    const checksum = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(payload)));
    const expected = this.incoming.data.slice(0, 32);
    if (!checksum.every((byte, index) => byte === expected[index])) {
      this.rejectAll(new Error("Hardware wallet response checksum mismatch"));
      this.incoming.offset = 0;
      this.incoming.length = 0;
      return;
    }

    const message = decodeCbor(payload);
    this.onmessage?.(message);
    if (typeof message === "object" && message !== null && !Array.isArray(message) && !(message instanceof Uint8Array)) {
      const id = typeof message.id === "number" ? message.id : -1;
      const pending = this.pendingReplies.get(id);
      if (pending) {
        this.pendingReplies.delete(id);
        window.clearTimeout(pending.timeout);
        if ("result" in message) {
          pending.resolve(message.result);
        } else if ("error" in message && typeof message.error === "object" && message.error !== null) {
          const errorMessage =
            "message" in message.error && typeof message.error.message === "string"
              ? message.error.message
              : "Hardware wallet request failed";
          pending.reject(new Error(errorMessage));
        }
      }
    }

    this.incoming.offset = 0;
    this.incoming.length = 0;
  }

  private async write(data: Uint8Array): Promise<void> {
    this.serial = this.serial.then(() => this.content.writeValue(toArrayBuffer(data)));
    await this.serial;
  }

  private read(): Uint8Array {
    const length = this.readBuffer.reduce((sum, bytes) => sum + bytes.length, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const bytes of this.readBuffer) {
      result.set(bytes, offset);
      offset += bytes.length;
    }
    this.readBuffer = [];
    return result;
  }

  private async readResult(): Promise<Uint8Array> {
    for (let i = 0; i < 1000; i++) {
      const result = this.read();
      if (result.length) {
        if (result[0] & ERROR_MASK) {
          throw fireflyProtocolError(result[0]);
        }
        return result;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1));
    }
    throw new Error("Timed out waiting for hardware wallet response");
  }

  private async sendCommand(command: number, data = new Uint8Array()): Promise<Uint8Array | undefined> {
    const payload = new Uint8Array(1 + data.length);
    payload[0] = command;
    payload.set(data, 1);
    await this.write(payload);

    if (command === CMD_QUERY) {
      const result = await this.readResult();
      if (result[1] !== CMD_QUERY) {
        throw new Error(`Unexpected query response: ${bytesToHex(result)}`);
      }
      return result;
    }

    return undefined;
  }

  private async query(): Promise<FireflyQuery> {
    const result = await this.sendCommand(CMD_QUERY, new Uint8Array([0x01]));
    if (!result) throw new Error("Missing Firefly query response");

    this.queryCache = {
      version: result[2],
      offset: toNumber(result.slice(3, 5)),
      length: toNumber(result.slice(5, 7)),
      model: toNumber(result.slice(7, 11)),
      serial: toNumber(result.slice(11, 15)),
    };
    return this.queryCache;
  }

  private async reset(): Promise<void> {
    await this.sendCommand(CMD_RESET);
  }

  private async chunkAndSendMessage(message: Uint8Array): Promise<void> {
    const checksum = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(message)));
    const checkedMessage = new Uint8Array(checksum.length + message.length);
    checkedMessage.set(checksum, 0);
    checkedMessage.set(message, checksum.length);

    await this.reset();
    for (let offset = 0; offset < checkedMessage.length; offset += CHUNK_SIZE) {
      const data = checkedMessage.slice(offset, offset + CHUNK_SIZE);
      const preamble = offset === 0 ? checkedMessage.length : offset;
      const command = offset === 0 ? CMD_START_MESSAGE : CMD_CONTINUE_MESSAGE;
      const payload = new Uint8Array(data.length + 2);
      payload[0] = preamble >> 8;
      payload[1] = preamble & 0xff;
      payload.set(data, 2);
      await this.sendCommand(command, payload);
    }
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pendingReplies.values()) {
      window.clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingReplies.clear();
  }
}
