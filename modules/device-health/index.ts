import { requireOptionalNativeModule } from 'expo-modules-core';

export interface DeviceHealthNative {
  addListener(event: 'onThermalChange', listener: (event: unknown) => void): { remove(): void };
  start(): Promise<void>;
  stop(): Promise<void>;
  sample(): Promise<unknown>;
}

export default requireOptionalNativeModule<DeviceHealthNative>('DeviceHealth');
