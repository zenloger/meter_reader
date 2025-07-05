import React from 'react';
import { loadTensorflowModel, TensorflowModel, useTensorflowModel } from 'react-native-fast-tflite';
import { PhotoFile, runAsync, useFrameProcessor } from 'react-native-vision-camera';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { Frame } from 'react-native-vision-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';
import {Buffer} from 'buffer';
import { Platform } from 'react-native';
import Canvas from 'react-native-canvas';
import {NativeModules} from 'react-native';
import { useSharedValue, Worklets } from 'react-native-worklets-core';

export const convertPngToArrayBuffer = async (imageUri: string) => {
  try {
    // 1. Fetch the image as a Blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // 2. Create a FileReader to read the Blob as an ArrayBuffer
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        if (reader.readyState === FileReader.DONE) {
          resolve(reader.result);
        }
      };

      reader.onerror = (error) => {
        reject(error);
      };

      reader.readAsArrayBuffer(blob);
    });

    return arrayBuffer;
  } catch (error) {
    console.error('Error converting PNG to ArrayBuffer:', error);
    throw error;
  }
};

interface PhotoAnalysis {
  value: number;
  unit: string;
  confidence: number;
  type: 'gas' | 'water' | 'electricity';
}

interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
    class: number;
    confidence: number;
}

export default function useYolo() {
    const { model } = useTensorflowModel(require('@/assets/models/best_float16.tflite'));
    const { resize } = useResizePlugin();
    const canvasRef = React.useRef<Canvas>(null);
    const state = useSharedValue(0);
    const boxes = useSharedValue<Box[]>([]);

    const frameProcessor = useFrameProcessor((frame) => {
        'worklet'
        if (!model) return;

        if (state.value != 0) return;
        state.value = 1;
 
        const data = resize(frame, {
            scale: {
                width: 256,
                height: 256,
            },
            pixelFormat: 'rgb',
            dataType: 'float32'
        });

        let newBoxes: Box[] = [];

        let inference = () => {
            let c = Date.now();
            const output = (model.runSync([data])[0]) as Float32Array;
            let d = Date.now();
            console.log((d - c) / 1000);
            console.log(output.length);
    
            // 14 x OUTPUT_SIZE
            const OUTPUT_SIZE = 1344;
            let confidence = new Float32Array(10);
            for (let i = 0; i < OUTPUT_SIZE; i++) {
                // data[0][i]
                let y = output[0 * OUTPUT_SIZE + i];
                let x = output[1 * OUTPUT_SIZE + i];
                let w = output[2 * OUTPUT_SIZE + i];
                let h = output[3 * OUTPUT_SIZE + i];
                
                // let x = output[i * 14 + 0];
                // let y = output[i * 14 + 1];
                // let w = output[i * 14 + 2];
                // let h = output[i * 14 + 3];
    
                let maxV = 0, maxI = 0;
                for (let j = 0; j < 10; j++) {
                    confidence[j] = output[(j + 4) * OUTPUT_SIZE + i];
                    // confidence[j] = output[i * 14 + (j + 4)];
                    if (confidence[j] > maxV) {
                        maxV = confidence[j];
                        maxI = j;
                    }
                }
    
                newBoxes.push({
                    x, y, w, h, class: maxI, confidence: maxV
                });
            }
    
            newBoxes.sort((a, b) => b.confidence - a.confidence);
            state.value = 0;
            boxes.value = newBoxes.filter(v => v.confidence >= 0.5).slice(0, 5);
            console.log(newBoxes.slice(0, 10).map(v => v.class));
        }
        inference();
        state.value = 0;
    }, [model])

    return {
        frameProcessor,
        boxes: boxes.value
    };
}