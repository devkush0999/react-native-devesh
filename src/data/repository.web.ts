import { snapshotSchema } from '../domain/models';
import type { VaultRepository } from './repository.types';

const key = 'saathi.preview.v1';
export const repository: VaultRepository = {
  async load() {
    const raw = localStorage.getItem(key);
    return raw ? snapshotSchema.parse(JSON.parse(raw)) : null;
  },
  async save(snapshot) {
    localStorage.setItem(key, JSON.stringify(snapshotSchema.parse(snapshot)));
  },
};
