import { requireOptionalNativeModule, type NativeModule } from 'expo-modules-core';

export type DeviceHealthNative = NativeModule<{
  onThermalChange: (event: unknown) => void;
}> & {
  start(): Promise<void>;
  stop(): Promise<void>;
  sample(): Promise<unknown>;
};

export default requireOptionalNativeModule<DeviceHealthNative>('DeviceHealth');
