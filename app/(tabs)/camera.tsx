import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, Dimensions } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, Frame, PhotoFile } from 'react-native-vision-camera';
import React, { useState, useRef, useEffect, useReducer } from 'react';
import { Camera as CameraIcon, FlipHorizontal, Zap, Check, Sun } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { analyzeImage } from '@/utils/imageAnalysis';
import { storeReading, initDB } from '@/utils/storage';
import { useFocusEffect, useRouter } from 'expo-router';
import useYolo from '@/hooks/useYolo';
import Canvas, { Image } from 'react-native-canvas';
import * as ImageManipulator from 'expo-image-manipulator';

export default function CameraTab() {
  const { frameProcessor, boxes } = useYolo();
  const canvasRef = React.useRef<Canvas>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastReading, setLastReading] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null);
  const router = useRouter();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState('м³');
  const [editPhoto, setEditPhoto] = useState<any>(null);
  const [editConfidence, setEditConfidence] = useState(0.9);
  const [frameId, incrementFrameId] = useReducer((x: number) => x + 1, 0);
  const [torch, setTorch] = useState(false);

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
  
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = Dimensions.get('window').width;
      canvasRef.current.height = Dimensions.get('window').height;
      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      let cc = [...boxes, {
        x: 0.03,
        y: 0.03,
        w: 0.9,
        h: 0.9
      }];
      for (let box of cc) {
        ctx.rect(box.x * width, box.y * height, box.w * width, box.h * height);
        // console.log(box.x * width, box.y * height, box.w * width, box.h * height);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f0";
      ctx.stroke();
    }, 1000);

    return () => {
      clearInterval(interval);
    }
  }, [boxes])

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

    setIsProcessing(true);
    
    try {
      const photo: PhotoFile = await cameraRef.current.takePhoto();

      if (photo) {
        // Вызываем handlePhoto для анализа изображения
        const analysis = {} as any;

        // Открываем модальное окно для редактирования
        setEditValue(String(analysis.value || 0));
        setEditUnit(analysis.unit || 'м³');
        setEditPhoto(photo);
        setEditConfidence(analysis.confidence || 0.9);
        setEditModalVisible(true);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Ошибка', 'Не удалось обработать изображение. Пожалуйста, попробуйте еще раз.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveReading = async () => {
    if (!editPhoto) return;
    const reading = {
      id: Date.now().toString(),
      value: Number(editValue),
      unit: editUnit,
      confidence: editConfidence,
      imageUri: editPhoto.path,
      timestamp: new Date().toISOString(),
      type: 'gas' as const,
    };
    await storeReading(reading);
    setLastReading(`${reading.value} ${reading.unit}`);
    setEditModalVisible(false);
    setEditPhoto(null);
    // Показываем сообщение об успехе
    Alert.alert(
      'Чтение записано!',
      `Обнаруженное значение: ${reading.value} ${reading.unit}\nУверенность: ${(reading.confidence * 100).toFixed(1)}%`,
      [
        { text: 'Сделать еще одно', style: 'default' },
        { text: 'Просмотр истории', onPress: () => router.push('/(tabs)/history') },
      ]
    );
  };

  const handleCancelEdit = () => {
    setEditModalVisible(false);
    setEditPhoto(null);
  };

  const toggleCameraFacing = () => {
    // Для react-native-vision-camera нужно переключать device
    // Это будет реализовано позже
  };

  return (
    <View style={styles.container}>
      <View style={styles.cameraContainer}>
        <Camera
          key={frameId}
          style={styles.camera}
          device={device}
          isActive={true}
          ref={cameraRef}
          photo={true}
          frameProcessor={frameProcessor}
        />
        <Canvas style={styles.camera} ref={canvasRef} />
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent']}
          style={styles.topOverlay}
        >
          <Text style={styles.headerText}>Meter Reader</Text>
          <Text style={styles.subHeaderText}>Поместите дисплей счетчика в центр</Text>
        </LinearGradient>

        <View style={styles.cameraOverlay}>
          <View style={styles.frameGuide}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.bottomOverlay}
        >
          {lastReading && (
            <View style={styles.lastReadingContainer}>
              <Check size={16} color="#10b981" />
              <Text style={styles.lastReadingText}>Last: {lastReading}</Text>
            </View>
          )}
          
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={toggleCameraFacing}
              activeOpacity={0.8}
            >
              <FlipHorizontal size={24} color="#ffffff" />
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
      </View>
      {/* Модальное окно для ручной корректировки */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Проверьте и скорректируйте показание</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editValue}
              onChangeText={setEditValue}
              placeholder="Показание"
            />
            <Text style={styles.unitText}>{editUnit}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonCancel} onPress={handleCancelEdit}>
                <Text style={styles.modalButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonSave} onPress={handleSaveReading}>
                <Text style={styles.modalButtonTextSave}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={{position: 'absolute', top: 0, left: 0, width: 100, height: 100}}>
        <Canvas ref={canvasRef} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraContainer: {
    height: '100%',
  },
  camera: {
    width: '100%',
    height: '100%',
    flex: 1,
    position: 'absolute'
  },
  topOverlay: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerText: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
  },
  subHeaderText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#e5e7eb',
    textAlign: 'center',
    opacity: 0.9,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameGuide: {
    width: 280,
    height: 200,
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
    paddingBottom: 100,
    paddingHorizontal: 20,
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    marginBottom: 16,
    color: '#111827',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
    textAlign: 'center',
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
    color: '#ааа',
  },
  modalButtonTextSave: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
});