import * as SQLite from 'expo-sqlite';
import { MeterReading } from '@/types';

const db = SQLite.openDatabaseSync('meter_readings.db');
let dbInitialized = false;

async function ensureDBInitialized() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

// Инициализация таблицы
export const initDB = async () => {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY NOT NULL,
      value REAL,
      unit TEXT,
      confidence REAL,
      imageUri TEXT,
      timestamp TEXT,
      type TEXT
    );`
  );
};

export const getStoredReadings = async (): Promise<MeterReading[]> => {
  await ensureDBInitialized();
  const rawResult: unknown = await db.execAsync('SELECT * FROM readings ORDER BY timestamp DESC;');
  const result = rawResult as any[];
  return result && result[0]?.rows ? (result[0].rows as MeterReading[]) : [];
};

function escapeStr(str: string) {
  return str.replace(/'/g, "''");
}

export const storeReading = async (reading: MeterReading): Promise<void> => {
  await ensureDBInitialized();
  await db.execAsync(
    `INSERT INTO readings (id, value, unit, confidence, imageUri, timestamp, type) VALUES ('${escapeStr(reading.id)}', ${reading.value}, '${escapeStr(reading.unit)}', ${reading.confidence}, '${escapeStr(reading.imageUri)}', '${escapeStr(reading.timestamp)}', '${escapeStr(reading.type)}');`
  );
};

export const deleteReading = async (id: string): Promise<void> => {
  await ensureDBInitialized();
  await db.execAsync(`DELETE FROM readings WHERE id = '${escapeStr(id)}';`);
};

export const clearAllReadings = async (): Promise<void> => {
  await ensureDBInitialized();
  await db.execAsync('DELETE FROM readings;');
};