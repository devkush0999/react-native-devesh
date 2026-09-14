import type { Snapshot } from '../domain/models';

export interface VaultRepository {
  load(): Promise<Snapshot | null>;
  save(snapshot: Snapshot): Promise<void>;
}
