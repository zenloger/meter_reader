import React from 'react';
import { loadTensorflowModel, TensorflowModel, useTensorflowModel } from 'react-native-fast-tflite';
import { PhotoFile } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Frame } from 'react-native-vision-camera';

interface PhotoAnalysis {
  value: number;
  unit: string;
  confidence: number;
  type: 'gas' | 'water' | 'electricity';
}

export default function useYolo() {
    const { model } = useTensorflowModel(require('@/assets/models/best_float16.tflite'));
    const { resize } = useResizePlugin();

    const handlePhoto = React.useCallback(async (photo: PhotoFile): Promise<PhotoAnalysis> => {
        if (!model || !resize) {
            // Fallback если модель или resize недоступны
            return {
                value: Math.floor(Math.random() * 10000) / 100,
                unit: 'м³',
                confidence: 0.8 + Math.random() * 0.2,
                type: 'gas'
            };
        }

        try {
            

            // Запускаем модель
            const output = await model.run([resized]);
            
            // Обрабатываем результат (здесь нужно адаптировать под вашу модель)


            // Пока возвращаем моковые данные
            return {
                value: Math.floor(Math.random() * 10000) / 100,
                unit: 'м³',
                confidence: 0.8 + Math.random() * 0.2,
                type: 'gas'
            };
        } catch (error) {
            console.error('Error processing photo:', error);
            // Возвращаем fallback данные при ошибке
            return {
                value: 0,
                unit: 'м³',
                confidence: 0.5,
                type: 'gas'
            };
        }
    }, [model, resize]);

    return {
        handlePhoto
    };
}