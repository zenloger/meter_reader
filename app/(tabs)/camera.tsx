import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import React, { useState, useRef, useEffect, useReducer } from 'react';
import { Camera, FlipHorizontal, Zap, Check, Sun } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { analyzeImage } from '@/utils/imageAnalysis';
import { storeReading, initDB } from '@/utils/storage';
import { useFocusEffect, useRouter } from 'expo-router';

export default function CameraTab() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastReading, setLastReading] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
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

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Camera size={64} color="#2563eb" />
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

  const takePicture = async () => {
    if (!cameraRef.current || isProcessing) return;

    setIsProcessing(true);
    
    try {
      requestPermission();
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (photo) {
        // Мокаем результат анализа
        const randomValue = Math.floor(Math.random() * 10000) / 100;
        const analysis = {
          value: randomValue,
          unit: 'м³',
          confidence: 0.8 + Math.random() * 0.2,
          type: 'gas' as const,
        };
        // Открываем модальное окно для редактирования
        setEditValue(String(analysis.value));
        setEditUnit(analysis.unit);
        setEditPhoto(photo);
        setEditConfidence(analysis.confidence);
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
      imageUri: editPhoto.uri,
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
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <View style={styles.container}>
      <CameraView
        key={frameId}
        style={styles.camera}
        facing={facing}
        ref={cameraRef}
        enableTorch={torch}
      >
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
                  <Camera size={32} color="#ffffff" />
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
      </CameraView>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
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