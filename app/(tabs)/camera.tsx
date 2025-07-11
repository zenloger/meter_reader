import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Dimensions, LayoutRectangle, Image, ScrollView } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, Frame, PhotoFile, useCameraFormat, useFrameProcessor } from 'react-native-vision-camera';
import React, { useState, useRef, useEffect, useReducer } from 'react';
import { Camera as CameraIcon, FlipHorizontal, Zap, Check, Sun, WatchIcon, Sparkles, Save, X, Edit, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { analyzeImage } from '@/utils/imageAnalysis';
import { storeReading, initDB } from '@/utils/storage';
import { useFocusEffect, useRouter } from 'expo-router';
import useYolo from '@/hooks/useYolo';
import Canvas from 'react-native-canvas';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { PNG } from 'pngjs/browser';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { ISharedValue, useSharedValue } from 'react-native-worklets-core';
import { Buffer } from 'buffer';

const CAMERA_SIZE = Dimensions.get('screen').width;

function MeterValue(props: { meterValue: ISharedValue<string> }) {
  const [_, forceUpdate] = React.useReducer(x => x + 1, 0);
  const {meterValue} = props;

  React.useLayoutEffect(() => {
    const interval = setInterval(() => {
      forceUpdate();
    }, 50);

    return () => {
      clearInterval(interval);
    }
  }, [meterValue])

  return (
    <>
      {meterValue.value.split('').map((char, idx) => (
        <View key={idx} style={styles.meterDigitBox}>
          <Text style={styles.meterDigit}>{char}</Text>
        </View>
      ))}
    </>
  );
}

export default function CameraTab() {
  const { ocrModel, modelWorklet, frameProcessor, boxes, meterValue, inference, inferenceIndicator, ransac, nms } = useYolo();
  // const boxes = React.useState([]);
  // const meterValue = useSharedValue('123');
  // const inference = () => {};
  // const ransac = () => {};
  // const nms = () => {};
  const canvasRef = React.useRef<Canvas>(null);
  const photoCanvasRef = React.useRef<Canvas>(null);
  const [layout, setLayout] = React.useState<LayoutRectangle|null>(null);
  const device = useCameraDevice('back');
  const deviceFormat = useCameraFormat(device, [{
    photoResolution: {
      width: 720,
      height: 720
    }
  }]);
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastReading, setLastReading] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null);
  const router = useRouter();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTempValue, setEditTempValue] = useState('');
  const [editUnit, setEditUnit] = useState('м³');
  const [editPhoto, setEditPhoto] = useState<any>(null);
  const [editConfidence, setEditConfidence] = useState(0.9);
  const [frameId, incrementFrameId] = useReducer((x: number) => x + 1, 0);
  const [torch, setTorch] = useState(false);
  const [fpsShown, setFpsShown] = useState(false);
  const [photo, setPhoto] = useState<string|null>(null);
  const [inputValue, setInputValue] = useState('');
  const [candidates, setCandidates] = useState([
    { label: 'YOLO', value: '1234.56' },
    { label: 'OCR', value: '1235.00' },
    { label: 'MOCK', value: '9999.99' },
  ]);

  const isProcessingShared = useSharedValue(false);
  isProcessingShared.value = isProcessing;

  const frameProcessorWrapper = useFrameProcessor((frame) => {
    'worklet'
    if (isProcessingShared.value) {
      return;
    }
    return frameProcessor(frame);
  }, [modelWorklet]);

  useEffect(() => {
    // initDB больше не нужен, инициализация происходит автоматически
    requestPermission();
  }, []);

  useFocusEffect(
    // useCallback нужен для оптимизации и предотвращения лишних вызовов
    // loadReadings будет вызываться при каждом фокусе экрана
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useCallback(() => {
      requestPermission();
      incrementFrameId();
    }, [])
  );

  React.useLayoutEffect(() => {
    const interval = setInterval(() => {
      if (!canvasRef.current) return;
      if (!cameraRef.current) return;
      if (!layout) return;
  
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = layout.width;
      canvasRef.current.height = layout.height;
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      const delta = height - width;
      for (let box of boxes) {
        ctx.strokeStyle = box.class < 10 ? '#0f0' : '#ff0';
        if (box.class == 10) ctx.strokeStyle = '#00f';

        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.rect((box.x - box.w / 2) * width, (box.y - box.h / 2) * width + delta / 2, box.w * width, box.h * width);
        ctx.closePath();
      }
    }, 50);

    return () => {
      clearInterval(interval);
    }
  }, [boxes, layout])

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <CameraIcon size={64} color="#2563eb" />
          <Text style={styles.permissionTitle}>Требуется разрешение на камеру</Text>
          <Text style={styles.permissionMessage}>
            Нам нужно доступ к вашей камере для захвата показаний счетчика
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Предоставить разрешение</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <CameraIcon size={64} color="#2563eb" />
          <Text style={styles.permissionTitle}>Камера недоступна</Text>
          <Text style={styles.permissionMessage}>
            Не удалось получить доступ к камере устройства
          </Text>
        </View>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || isProcessing) return;
    let newCandidates: typeof candidates = []
    if (meterValue.value.trim()) {
      newCandidates.push({ 'label': 'YOLO RealTime', 'value': meterValue.value });
    }

    const wait = (ms: number) => new Promise(resolve => {
      setTimeout(resolve, ms);
    });

    try {
      setIsProcessing(true);

      // const photo: PhotoFile = await cameraRef.current.takePhoto({
      //   flash: 'auto',
      // });
      const photo: PhotoFile = await cameraRef.current.takeSnapshot();
      setTorch(false);

      const canvas = photoCanvasRef.current!;
      canvas.width = CAMERA_SIZE;
      canvas.height = CAMERA_SIZE;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, CAMERA_SIZE, CAMERA_SIZE);
      const delta = 0;

      const photoPath = `file:///${photo?.path}`;

      // 1. Сохраняем фото в PNG с resize 416x416
      // Сначала определяем crop по центру, квадрат минимальной из сторон
      const photoInfo = await ImageManipulator.manipulateAsync(
        photoPath,
        [],
        { base64: false }
      );
      const origWidth = photoInfo.width;
      const origHeight = photoInfo.height;
      const minSide = Math.min(origWidth, origHeight);
      const cropOriginX = Math.floor((origWidth - minSide) / 2);
      const cropOriginY = Math.floor((origHeight - minSide) / 2);

      const manipResult = await ImageManipulator.manipulateAsync(
        photoPath,
        [
          { crop: { originX: cropOriginX, originY: cropOriginY, width: minSide, height: minSide } },
          { resize: { width: 640, height: 640 } }
        ],
        { format: ImageManipulator.SaveFormat.PNG }
      );

      setCandidates(newCandidates);
      setPhoto(manipResult.uri);

      // 2. Читаем PNG-файл в буфер
      const pngUri = manipResult.uri;
      const pngBase64 = await FileSystem.readAsStringAsync(pngUri, { encoding: FileSystem.EncodingType.Base64 });

      // Преобразуем base64 в Buffer, чтобы pngjs мог корректно декодировать
      // const pngBuffer = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
      const pngBuffer = new Buffer(pngBase64, 'base64');

      // 3. Декодируем PNG через pngjs
      const png = PNG.sync.read(pngBuffer);
      const rgbData = [];

      for (let i = 0; i < png.data.length; i++) {
        if (i % 4 != 3) {
          rgbData.push(png.data[i] / 255.);
        }
      }

      const floatArray = new Float32Array(rgbData.length);
      for (let i = 0; i < png.height; i++) {
        for (let j = 0; j < png.width; j++) {
          for (let k = 0; k < 3; k++) {
            floatArray[(j * png.height + i) * 3 + k] = rgbData[(i * png.width + (png.width - 1 - j)) * 3 + k];
          }
        }
      }

      const bboxes = ransac(nms(inference(floatArray)));

      const finalBoxes = ([] as typeof bboxes).sort.call(bboxes, ((a, b) => a.x - b.x));
      let result = '';
      for (let i of finalBoxes) {
        result += i.class.toString();
      }
      
      newCandidates = [...newCandidates, { label: 'YOLO', value: result }];
      setCandidates(newCandidates);

      for (let box of bboxes) {
        ctx.rect((box.x - box.w / 2) * CAMERA_SIZE, (box.y - box.h / 2) * CAMERA_SIZE + delta / 2, box.w * CAMERA_SIZE, box.h * CAMERA_SIZE);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f0";
      ctx.stroke();

      // INDICATOR
      const indicatorManipResult = await ImageManipulator.manipulateAsync(
        photoPath,
        [
          { crop: { originX: cropOriginX, originY: cropOriginY, width: minSide, height: minSide } },
          { resize: { width: 224, height: 224 } }
        ],
        { format: ImageManipulator.SaveFormat.PNG }
      );

      const indicatorPngUri = indicatorManipResult.uri;
      const indicatorPngBase64 = await FileSystem.readAsStringAsync(indicatorPngUri, { encoding: FileSystem.EncodingType.Base64 });

      const indicatorPngBuffer = new Buffer(indicatorPngBase64, 'base64');

      const indicatorPng = PNG.sync.read(indicatorPngBuffer);
      const indicatorRgbData = [];

      for (let i = 0; i < indicatorPng.data.length; i++) {
        if (i % 4 != 3) {
          indicatorRgbData.push(indicatorPng.data[i] / 255.);
        }
      }

      const indicatorFloatArray = new Float32Array(indicatorRgbData.length);
      for (let i = 0; i < indicatorPng.height; i++) {
        for (let j = 0; j < indicatorPng.width; j++) {
          for (let k = 0; k < 3; k++) {
            indicatorFloatArray[(j * indicatorPng.height + i) * 3 + k] = indicatorRgbData[(i * indicatorPng.width + (indicatorPng.width - 1 - j)) * 3 + k];
          }
        }
      }

      const indicatorBboxes = nms(inferenceIndicator(indicatorFloatArray, 0.5));
      console.log(indicatorBboxes);

      for (let box of indicatorBboxes) {
        ctx.beginPath();
        ctx.strokeStyle = '#ff0';
        ctx.strokeRect((box.x - box.w / 2) * CAMERA_SIZE, (box.y - box.h / 2) * CAMERA_SIZE + delta / 2, box.w * CAMERA_SIZE, box.h * CAMERA_SIZE);
        ctx.closePath();
      }


      // Создаём маску PNG такого же размера, как исходное изображение, и заполняем её нулями
      let pngMaskData = new Uint8Array(png.width * png.height * 4).fill(0);

      // Копируем пиксели из исходного PNG в маску только для областей, попадающих в bounding boxes
      for (let box of indicatorBboxes) {
        // Переводим координаты бокса в пиксели
        const hPadding = 10;
        const wPadding = 30;
        const x0 = Math.max(0, Math.floor((box.x - box.w / 2) * png.width) - wPadding);
        const y0 = Math.max(0, Math.floor((box.y - box.h / 2) * png.height) - hPadding);
        const x1 = Math.min(png.width, Math.ceil((box.x + box.w / 2) * png.width) + wPadding);
        const y1 = Math.min(png.height, Math.ceil((box.y + box.h / 2) * png.height) + hPadding);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = (y * png.width + x) * 4;
            pngMaskData[idx] = png.data[idx];       // R
            pngMaskData[idx + 1] = png.data[idx+1]; // G
            pngMaskData[idx + 2] = png.data[idx+2]; // B
            pngMaskData[idx + 3] = png.data[idx+3]; // A
          }
        }
      }

      // Создаём новый PNG-объект для маски
      let pngMaskObj = new PNG({ width: png.width, height: png.height });
      for (let i = 0; i < pngMaskObj.data.length; i++) {
        pngMaskObj.data[i] = pngMaskData[i];
      }

      // Сохраняем маску во временный файл и получаем URI
      const maskBuffer = PNG.sync.write(pngMaskObj);
      const maskBase64 = Buffer.from(maskBuffer).toString('base64');
      const maskUri = FileSystem.cacheDirectory + `mask_${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(maskUri, maskBase64, { encoding: FileSystem.EncodingType.Base64 });
      setPhoto(maskUri);
      // Теперь maskUri содержит путь к PNG-маске

      for (let box of bboxes) {
        ctx.beginPath();
        ctx.strokeStyle = '#0f0';
        ctx.rect((box.x - box.w / 2) * CAMERA_SIZE, (box.y - box.h / 2) * CAMERA_SIZE + delta / 2, box.w * CAMERA_SIZE, box.h * CAMERA_SIZE);
        ctx.closePath();
      }

      let resultOcr = '';
      // Вырезаем участок картинки, соответствующий боксу, и сохраняем его в отдельный PNG-файл
      // Используем expo-image-manipulation для обрезки и сохранения
      if (bboxes.length) {
        try {
          const detections = await ocrModel.forward(maskUri);
          // setPhoto(cropped.uri);
          console.log(detections);
          detections.sort((a, b) => b.score - a.score);
          if (detections.length) {
            for (let ch of detections[0].text) {
              if ('0' <= ch && ch <= '9') {
                resultOcr += ch;
              }
            }
            newCandidates = [...newCandidates, {
              label: 'OCR (Mask)',
              value: resultOcr
            }];
            setCandidates(newCandidates);
          }
        } catch (e) {
          console.warn('Ошибка при сохранении участка картинки:', e);
        }
      }

      setPhoto(pngUri);
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Ошибка', 'Не удалось обработать изображение. Пожалуйста, попробуйте еще раз.');
    } finally {
      await wait(500);
      setIsProcessing(false);
    }
  };

  const handleSaveReading = async () => {
    try {
      const reading = {
        id: Date.now().toString(),
        value: Number(inputValue),
        unit: editUnit,
        confidence: editConfidence,
        imageUri: `${photo}`,
        timestamp: new Date().toISOString(),
        type: 'gas' as const,
      };
      await storeReading(reading);
      setLastReading(`${reading.value} ${reading.unit}`);
      setEditModalVisible(false);
      setEditPhoto(null);
      setPhoto(null);
      setInputValue('');
      // Показываем сообщение об успехе
      Alert.alert(
        'Чтение записано!',
        `Обнаруженное значение: ${reading.value} ${reading.unit}`,
        [
          { text: 'Сделать еще одно', style: 'default' },
          { text: 'Просмотр истории', onPress: () => router.push('/(tabs)/history') },
        ]
      );
    }
    catch (e) {
      console.log(e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.cameraContainer, {
        display: photo ? 'flex' : 'none'
      }]}>
        <Canvas style={styles.canvasOverlay} ref={photoCanvasRef} />
        {photo && <Image style={styles.camera} src={`${photo}`} />}
      </View>
      <View style={[styles.cameraContainer, {
        display: photo ? 'none' : 'flex'
      }]}>
        <Canvas style={styles.canvasOverlay} ref={canvasRef} />
        { !photo &&
          <Camera
            key={frameId}
            torch={torch ? 'on' : 'off'}
            format={deviceFormat}
            onLayout={event => setLayout(event.nativeEvent.layout)}
            style={styles.camera}
            fps={10}
            device={device}
            isActive={true}
            ref={cameraRef}
            enableFpsGraph={fpsShown}
            photo={true}
            preview={true}
            frameProcessor={frameProcessorWrapper}
          />
        }
        <View style={styles.cameraOverlay}>
          <View style={styles.frameGuide}>
            <View style={[styles.corner, styles.topLeft, {
              display: fpsShown ? 'none' : 'flex'
            }]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>
      </View>
      <View style={[styles.meterReadingsBlock, {
        display: photo ? 'none' : 'flex'
      }]}>
        <View style={styles.meterReadingRow}>
          <MeterValue meterValue={meterValue} />
        </View>
      </View>
      <LinearGradient
        colors={["#232526", "#414345"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.infoBlock, {
          display: photo ? 'none' : 'flex'
        }]}
      >
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Sparkles size={32} color="#ffd700" style={{ marginBottom: 4 }} />
          <Text style={styles.headerText}>Meter Reader</Text>
          <Text style={styles.subHeaderText}>Поместите дисплей счетчика в центр</Text>
          <Text style={styles.panelDescription}>AI-powered meter reading • v1.0</Text>
        </View>
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setFpsShown(t => !t)}
            activeOpacity={0.8}
          >
            <WatchIcon size={24} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
            onPress={takePicture}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            <View style={styles.captureButtonInner}>
              {isProcessing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <CameraIcon size={32} color="#ffffff" />
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setTorch(t => !t)}
            activeOpacity={0.8}
          >
            <Zap size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={["#232526", "#414345"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.infoBlock, {
          display: photo ? 'flex' : 'none'
        }]}
      >
        <Text style={styles.headerText}>Ручной ввод показаний</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            keyboardType="numeric"
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Введите показание"
            placeholderTextColor="#fff"
            cursorColor={'#fff'}
            editable={false}
          />
          <TouchableOpacity onPress={() => { setEditTempValue(inputValue); setEditModalVisible(true); }} style={styles.editIconButton}>
            <Edit size={22} color="#ffd700" />
          </TouchableOpacity>
        </View>
        <View style={styles.candidatesRow}>
          {candidates.length === 0 ? (
            <Text style={styles.candidatesEmptyText}>
              Ничего не найдено, попробуйте сделать ещё фотографию
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
              {candidates.map((c, idx) => (
                <TouchableOpacity
                  key={c.label}
                  style={styles.candidateButton}
                  onPress={() => setInputValue(c.value)}
                >
                  <Text style={styles.candidateLabel}>{c.label}</Text>
                  <Text style={styles.candidateValue}>{c.value}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
        {isProcessing ? (
          <View style={[styles.saveButtonsRow, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#ffd700" />
          </View>
        ) : (
          <View style={styles.saveButtonsRow}>
            <TouchableOpacity style={[styles.saveButton, styles.cancelButton]} onPress={() => { setPhoto(null); setInputValue(''); }}>
              <X size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { opacity: inputValue.trim() ? 1 : 0.5 }]}
              onPress={() => handleSaveReading()}
              disabled={!inputValue.trim()}
            >
              <Save size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.saveButtonText}>Сохранить</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* Модальное окно для изменения значения */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Иконка редактирования */}
            <View style={{ marginBottom: 8 }}>
              <Edit size={36} color="#ffd700" />
            </View>
            <Text style={styles.modalTitle}>Изменить показание</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editTempValue}
              onChangeText={setEditTempValue}
              placeholder="Введите новое значение"
              placeholderTextColor="#aaa"
              autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalSaveButton, styles.modalResetButton, { flex: 1, marginRight: 8 }]}
                onPress={() => setEditModalVisible(false)}
              >
                <RotateCcw size={22} color="#232526" style={{ marginRight: 8 }} />
                <Text style={styles.modalSaveButtonTextReset}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, styles.modalOkButton, { flex: 1, marginLeft: 8, opacity: editTempValue.trim() ? 1 : 0.5 }]}
                onPress={() => { if (editTempValue.trim()) { setInputValue(editTempValue); setEditModalVisible(false); } }}
                disabled={!editTempValue.trim()}
              >
                <Check size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.modalSaveButtonText}>ОК</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center', // Центрируем всё по горизонтали
    justifyContent: 'flex-start',
  },
  cameraContainer: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    alignSelf: 'center',
    position: 'relative',
    marginTop: 0,
    marginBottom: 16, // Добавим небольшой отступ снизу
  },
  camera: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    position: 'absolute',
    flex: 1,
    top: 0,
    left: 0,
  },
  canvasOverlay: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    position: 'absolute',
    flex: 1,
    top: 0,
    left: 0,
    zIndex: 2,
    pointerEvents: 'none',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CAMERA_SIZE,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 3,
  },
  headerText: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  subHeaderText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#e5e7eb',
    textAlign: 'center',
    opacity: 0.9,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    pointerEvents: 'none',
  },
  frameGuide: {
    width: CAMERA_SIZE * 0.8,
    height: CAMERA_SIZE * 0.8,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CAMERA_SIZE,
    paddingBottom: 32,
    paddingHorizontal: 20,
    zIndex: 3,
  },
  lastReadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
  },
  lastReadingText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    width: '100%',
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 50,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#111827',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#232526',
    borderRadius: 24,
    padding: 32,
    width: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    marginBottom: 18,
    color: '#ffd700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#ffd700',
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    fontFamily: 'Inter-Regular',
    marginBottom: 18,
    textAlign: 'center',
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  unitText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  modalButtonCancel: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  modalButtonSave: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#aaa',
  },
  modalButtonTextSave: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
  infoBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: 220,
    overflow: 'hidden',
  },
  panelDescription: {
    color: '#ffd700',
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    marginTop: 2,
    marginBottom: 2,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  meterReadingsBlock: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 0,
  },
  meterReadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  meterDigitBox: {
    width: 26,
    height: 34,
    backgroundColor: '#232526',
    borderRadius: 10,
    marginHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  meterDigit: {
    color: '#ffd700',
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  meterUnit: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    marginLeft: 4,
  },
  meterConfidence: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    marginTop: 1,
  },
  candidatesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  candidateButton: {
    backgroundColor: '#333',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  candidateLabel: {
    color: '#ffd700',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
  },
  candidateValue: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
    marginTop: 0,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 0,
    alignSelf: 'center',
    marginTop: 0,
    justifyContent: 'center',
  },
  modalOkButton: {
    backgroundColor: '#22c55e', // зелёная
  },
  modalResetButton: {
    backgroundColor: '#e5e7eb', // светло-серая
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  modalSaveButtonTextReset: {
    color: '#232526',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
  saveButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 100,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    marginRight: 16,
  },
  editIconButton: {
    marginLeft: 8,
    padding: 4,
  },
  candidatesEmptyText: {
    color: '#aaa',
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
    paddingVertical: 12,
  },
});