interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  writeValue(value: BufferSource): Promise<void>;
  value?: DataView;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: BluetoothServiceUUID): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice extends EventTarget {
  readonly gatt?: BluetoothRemoteGATTServer;
  readonly name?: string;
  forget?(): Promise<void>;
}

type BluetoothServiceUUID = number | string;

interface BluetoothRequestDeviceFilter {
  services?: BluetoothServiceUUID[];
}

interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  optionalServices?: BluetoothServiceUUID[];
}

interface Bluetooth {
  getDevices?(): Promise<BluetoothDevice[]>;
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
  readonly bluetooth?: Bluetooth;
}
