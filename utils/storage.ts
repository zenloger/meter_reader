import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeterReading } from '@/types';

const STORAGE_KEY = 'meter_readings';

export const getStoredReadings = async (): Promise<MeterReading[]> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting stored readings:', error);
    return [];
  }
};

export const storeReading = async (reading: MeterReading): Promise<void> => {
  try {
    const existingReadings = await getStoredReadings();
    const newReadings = [reading, ...existingReadings];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newReadings));
  } catch (error) {
    console.error('Error storing reading:', error);
    throw error;
  }
};

export const deleteReading = async (id: string): Promise<void> => {
  try {
    const existingReadings = await getStoredReadings();
    const filteredReadings = existingReadings.filter(reading => reading.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredReadings));
  } catch (error) {
    console.error('Error deleting reading:', error);
    throw error;
  }
};

export const clearAllReadings = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing all readings:', error);
    throw error;
  }
};