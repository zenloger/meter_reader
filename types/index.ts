export interface MeterReading {
  id: string;
  value: number;
  unit: string;
  confidence: number;
  imageUri: string;
  timestamp: string;
  type: 'electricity' | 'gas' | 'water' | 'general';
}

export interface ImageAnalysisResult {
  value: number;
  unit: string;
  confidence: number;
  type: 'electricity' | 'gas' | 'water' | 'general';
}