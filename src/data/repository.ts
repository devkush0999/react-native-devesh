import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { getRandomBytesAsync } from 'expo-crypto';
import { snapshotSchema } from '../domain/models';
import type { VaultRepository } from './repository.types';

let database: Promise<SQLiteDatabase> | undefined;

async function openVault(): Promise<SQLiteDatabase> {
  let key = await SecureStore.getItemAsync('saathi.vault.key');
  if (!key) {
    key = Array.from(await getRandomBytesAsync(32), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    await SecureStore.setItemAsync('saathi.vault.key', key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('The vault encryption key is invalid.');
  const db = await openDatabaseAsync('saathi-v1.db');
  // SQLCipher PRAGMA cannot be bound. Only the validated random hex key is interpolated.
  await db.execAsync(`PRAGMA key = "x'${key}'";`);
  const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version;');
  if (!cipher?.cipher_version) {
    await db.closeAsync();
    throw new Error(
      'Encrypted storage needs the Saathi development build. Expo Go is not supported.',
    );
  }
  await db.execAsync(
    'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS vault (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);',
  );
  return db;
}

function getDatabase() {
  database ??= openVault().catch((error: unknown) => {
    database = undefined;
    throw error;
  });
  return database;
}

export const repository: VaultRepository = {
  async load() {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM vault WHERE id = 1',
    );
    return row ? snapshotSchema.parse(JSON.parse(row.payload)) : null;
  },
  async save(snapshot) {
    const db = await getDatabase();
    const payload = JSON.stringify(snapshotSchema.parse(snapshot));
    await db.runAsync(
      'INSERT INTO vault (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
      payload,
    );
  },
};
