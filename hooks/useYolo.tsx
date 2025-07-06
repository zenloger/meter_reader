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
import {
  useOCR,
  DETECTOR_CRAFT_800,
  RECOGNIZER_EN_CRNN_512,
  RECOGNIZER_EN_CRNN_256,
  RECOGNIZER_EN_CRNN_128,
  RECOGNIZER_EN_CRNN_64,
} from 'react-native-executorch';

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
    const ocrModel = useOCR({
      detectorSource: DETECTOR_CRAFT_800,
      recognizerSources: {
        recognizerLarge: RECOGNIZER_EN_CRNN_512,
        recognizerMedium: RECOGNIZER_EN_CRNN_256,
        recognizerSmall: RECOGNIZER_EN_CRNN_128,
      },
      // Для распознавания только цифр используем язык 'digits'
      language: 'en',
      
    })

    const { model: modelIndicator } = useTensorflowModel(require('@/assets/models/indicator_float32_224.tflite'));
    const { model: modelWorklet } = useTensorflowModel(require('@/assets/models/better_float32_416.tflite'), 'android-gpu');
    const { model: model } = useTensorflowModel(require('@/assets/models/better_float32_640.tflite'), 'android-gpu');
    const { resize } = useResizePlugin();
    const canvasRef = React.useRef<Canvas>(null);
    const state = useSharedValue(0);
    const meterValue = useSharedValue('');
    const boxes = useSharedValue<Box[]>([]);

    const inference = (floatArray: Float32Array, confidenceLimit=0.04): Box[] => {
      let result: Box[] = [];
      if (!model) return [];
      const output = (model.runSync([floatArray])[0]) as Float32Array;

      // 14 x OUTPUT_SIZE
      const OUTPUT_SIZE = 8400;
      const CLASS_COUNT = 10;
      let confidence = new Float32Array(CLASS_COUNT);
      for (let i = 0; i < OUTPUT_SIZE; i++) {
          // data[0][i]
          let y = output[0 * OUTPUT_SIZE + i];
          let x = 1 - output[1 * OUTPUT_SIZE + i];
          let h = output[2 * OUTPUT_SIZE + i];
          let w = output[3 * OUTPUT_SIZE + i];
          
          // let x = output[i * 14 + 0];
          // let y = output[i * 14 + 1];
          // let w = output[i * 14 + 2];
          // let h = output[i * 14 + 3];

          let maxV = 0, maxI = 0;
          for (let j = 0; j < CLASS_COUNT; j++) {
              confidence[j] = output[(j + 4) * OUTPUT_SIZE + i];
              // confidence[j] = output[i * 14 + (j + 4)];
              if (confidence[j] > maxV) {
                  maxV = confidence[j];
                  maxI = j;
              }
          }

          if (maxV >= confidenceLimit) {
            result.push({
                x, y, w, h, class: maxI, confidence: maxV
            });
          }
      }

      // Sort boxes by confidence (highest first)
      return result;
    }

    const inferenceWorklet = (floatArray: Float32Array, confidenceLimit=0.04): Box[] => {
      'worklet'
      let result: Box[] = [];
      if (!modelWorklet) return [];
      const output = (modelWorklet.runSync([floatArray])[0]) as Float32Array;

      // 14 x OUTPUT_SIZE
      const OUTPUT_SIZE = 3549;
      const CLASS_COUNT = 10;
      let confidence = new Float32Array(CLASS_COUNT);
      for (let i = 0; i < OUTPUT_SIZE; i++) {
        let y = output[0 * OUTPUT_SIZE + i];
        let x = 1 - output[1 * OUTPUT_SIZE + i];
        let h = output[2 * OUTPUT_SIZE + i];
        let w = output[3 * OUTPUT_SIZE + i];

        let maxV = 0, maxI = 0;
        for (let j = 0; j < CLASS_COUNT; j++) {
            confidence[j] = output[(j + 4) * OUTPUT_SIZE + i];
            if (confidence[j] > maxV) {
                maxV = confidence[j];
                maxI = j;
            }
        }

        if (maxV >= confidenceLimit) {
          result.push({
              x, y, w, h, class: maxI, confidence: maxV
          });
        }
      }

      // Sort boxes by confidence (highest first)
      return result;
    }

    const inferenceIndicator = (floatArray: Float32Array, confidenceLimit=0.04): Box[] => {
      'worklet'
      let result: Box[] = [];
      if (!modelIndicator) return [];
      const output = (modelIndicator.runSync([floatArray])[0]) as Float32Array;

      // 14 x OUTPUT_SIZE
      const OUTPUT_SIZE = 1029;
      const CLASS_COUNT = 2;
      let confidence = new Float32Array(CLASS_COUNT);
      for (let i = 0; i < OUTPUT_SIZE; i++) {
        let y = output[0 * OUTPUT_SIZE + i];
        let x = 1 - output[1 * OUTPUT_SIZE + i];
        let h = output[2 * OUTPUT_SIZE + i];
        let w = output[3 * OUTPUT_SIZE + i];

        let maxV = 0, maxI = 10;
        for (let j = 0; j < CLASS_COUNT; j++) {
            confidence[j] = output[(j + 4) * OUTPUT_SIZE + i];
            if (confidence[j] > maxV) {
                maxV = confidence[j];
                maxI = 10 + j;
            }
        }

        if (maxV >= confidenceLimit) {
          result.push({
              x, y, w, h, class: maxI, confidence: maxV
          });
        }
      }

      return result;
    }

    const nms = (bboxes: Box[]): Box[] => {
      'worklet'
      bboxes.sort((a, b) => b.confidence - a.confidence);
      // Non-Maximum Suppression (NMS)
      const nmsThreshold = 0.5; // IoU threshold
      const nmsBoxes: Box[] = [];
      
      while (bboxes.length > 0) {
        const currentBox = bboxes[0];
        nmsBoxes.push(currentBox);
        bboxes.shift();
        
        for (let i = bboxes.length - 1; i >= 0; i--) {
          const iou = calculateIoU(currentBox, bboxes[i]);
          if (iou > nmsThreshold) {
            bboxes.splice(i, 1);
          }
        }
      }

      return nmsBoxes;
    }

    const ransac = (bboxes: Box[]): Box[] => {
      'worklet'
      let result: Box[] = [];
      if (bboxes.length >= 2) {
        const ransacResults = runRANSAC(bboxes);
        return ransacResults.inliers;
      } else {
        return bboxes;
      }
    }

    const frameProcessor = async (frame: Frame) => {
        'worklet'
        if (!model) return;

        if (state.value > 0) {
            state.value--;
            return;
        }
 
        const data = resize(frame, {
            scale: {
                width: 416,
                height: 416,
            },
            pixelFormat: 'rgb',
            dataType: 'float32'
        });

        const inferenceBoxes = inferenceWorklet(data, 0.04);
        const nmsBoxes = nms(inferenceBoxes);

        let finalBoxes: Box[] = ransac(nmsBoxes);

        finalBoxes = ([] as Box[]).sort.call(finalBoxes, ((a, b) => a.x - b.x));
        let result = '';
        for (let i of finalBoxes) {
          result += i.class.toString();
        }

        meterValue.value = result;
        boxes.value = [...finalBoxes];

        state.value = 0;
    }

    return {
        ocrModel,
        inferenceIndicator,
        model,
        modelWorklet,
        frameProcessor,
        boxes: boxes.value,
        meterValue,
        nms,
        ransac,
        inference
    };
}

// Helper function to calculate Intersection over Union (IoU)
function calculateIoU(box1: Box, box2: Box): number {
  'worklet'
  // Calculate coordinates of intersection rectangle
  const x1 = Math.max(box1.x - box1.w/2, box2.x - box2.w/2);
  const y1 = Math.max(box1.y - box1.h/2, box2.y - box2.h/2);
  const x2 = Math.min(box1.x + box1.w/2, box2.x + box2.w/2);
  const y2 = Math.min(box1.y + box1.h/2, box2.y + box2.h/2);
  
  // Calculate area of intersection
  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  
  // Calculate area of both boxes
  const box1Area = box1.w * box1.h;
  const box2Area = box2.w * box2.h;
  
  // Calculate union area
  const unionArea = box1Area + box2Area - intersectionArea;
  
  // Return IoU
  return intersectionArea / unionArea;
}

// Calculate distance between two boxes (simplified Euclidean distance between centers)
function boxDistance(box1: Box, box2: Box): number {
  'worklet'
  const dx = box1.x - box2.x;
  const dy = box1.y - box2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function runRANSAC(boxes: Box[], iterations = 30, distanceThreshold = 0.05): {
  line: {a: number, b: number, c: number},
  inliers: Box[]
} {
  'worklet'
  let bestLine = {a: 0, b: 0, c: 0};
  let bestInliers: Box[] = [];
  let maxInliers = 0;

  // Convert boxes to center points
  const points = boxes.map(box => ({
      x: box.x,
      y: box.y
  }));

  for (let i = 0; i < iterations; i++) {
      // Randomly select two points
      const idx1 = Math.floor(Math.random() * points.length);
      let idx2 = Math.floor(Math.random() * points.length);
      while (idx2 === idx1 && points.length > 1) {
          idx2 = Math.floor(Math.random() * points.length);
      }

      const p1 = points[idx1];
      const p2 = points[idx2];

      // Calculate line equation: ax + by + c = 0
      const a = p2.y - p1.y;
      const b = p1.x - p2.x;
      const c = p2.x * p1.y - p1.x * p2.y;

      // Normalize line coefficients
      const norm = Math.sqrt(a*a + b*b);
      const aNorm = a / norm;
      const bNorm = b / norm;
      const cNorm = c / norm;

      // Find inliers (points close to the line)
      const currentInliers: Box[] = [];
      for (let j = 0; j < points.length; j++) {
          const point = points[j];
          // Distance from point to line
          const distance = Math.abs(aNorm * point.x + bNorm * point.y + cNorm);
          
          if (distance < distanceThreshold) {
              currentInliers.push(boxes[j]);
          }
      }

      // Update best model if we found more inliers
      if (currentInliers.length > maxInliers) {
          maxInliers = currentInliers.length;
          bestInliers = currentInliers;
          bestLine = {a: aNorm, b: bNorm, c: cNorm};
      }
  }

  return {
      line: bestLine,
      inliers: bestInliers,
  };
}