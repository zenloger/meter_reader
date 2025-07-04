import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Trash2, Download, Info, CircleHelp as HelpCircle, Star } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { getStoredReadings, clearAllReadings } from '@/utils/storage';

export default function SettingsTab() {
  const [exportModalVisible, setExportModalVisible] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleClearData = () => {
    Alert.alert(
      'Удалить все данные',
      'Вы уверены, что хотите удалить все показания счетчика? Это действие не может быть отменено.',
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Удалить все', 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllReadings();
              Alert.alert('Успешно', 'Все показания удалены.');
            } catch (error) {
              console.error('Ошибка при очистке данных:', error);
              Alert.alert('Ошибка', 'Не удалось очистить данные. Пожалуйста, попробуйте еще раз.');
            }
          }
        },
      ]
    );
  };

  const handleExportData = () => {
    setExportModalVisible(true);
  };

  const exportAndShare = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      const readings = await getStoredReadings();
      if (!readings.length) {
        Alert.alert('Нет данных', 'Нет показаний для экспорта.');
        setExportModalVisible(false);
        setIsExporting(false);
        return;
      }
      let fileUri = '';
      if (format === 'json') {
        const json = JSON.stringify(readings, null, 2);
        fileUri = FileSystem.documentDirectory + 'meter_readings.json';
        await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
      } else {
        const csvHeader = 'id,value,unit,confidence,imageUri,timestamp,type';
        const csvRows = readings.map(r =>
          [r.id, r.value, r.unit, r.confidence, r.imageUri, r.timestamp, r.type]
            .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
        );
        const csv = [csvHeader, ...csvRows].join('\n');
        fileUri = FileSystem.documentDirectory + 'meter_readings.csv';
        await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      }
      setExportModalVisible(false);
      setIsExporting(false);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Готово', `Файл сохранен: ${fileUri}`);
      }
    } catch (e) {
      setIsExporting(false);
      setExportModalVisible(false);
      Alert.alert('Ошибка', 'Не удалось экспортировать файл.');
    }
  };

  const handleAbout = () => {
    Alert.alert(
      'О Meter Reader',
      'Версия 1.0.0\n\nУмное приложение для чтения показаний счетчиков с использованием ИИ для анализа изображений.\n\nРазработано с использованием React Native и Expo.',
      [{ text: 'OK' }]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      'Помощь и поддержка',
      '1. Направьте камеру на дисплей счетчика\n2. Убедитесь, что освещение хорошее\n3. Центрируйте цифры\n4. Нажмите кнопку захвата\n\nДля лучших результатов, сделайте фотографии в хорошо освещенных условиях.',
      [{ text: 'OK' }]
    );
  };

  const SettingsItem = ({ icon: Icon, title, subtitle, onPress, color = '#2563eb', destructive = false }: any) => (
    <TouchableOpacity
      style={[styles.settingsItem, destructive && styles.destructiveItem]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Icon size={20} color={destructive ? '#ef4444' : color} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, destructive && styles.destructiveText]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.itemSubtitle}>{subtitle}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2563eb', '#1d4ed8']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Настройки</Text>
        <Text style={styles.headerSubtitle}>Управляйте своими настройками</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Управление данными</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={Download}
              title="Экспорт данных"
              subtitle="Сохраните свои показания в CSV или JSON"
              onPress={handleExportData}
              color="#059669"
            />
            <SettingsItem
              icon={Trash2}
              title="Очистка всех данных"
              subtitle="Удалите все сохраненные показания"
              onPress={handleClearData}
              color="#ef4444"
              destructive
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Поддержка</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={HelpCircle}
              title="Помощь и советы"
              subtitle="Узнайте, как сделать лучшее чтение"
              onPress={handleHelp}
              color="#7c3aed"
            />
            <SettingsItem
              icon={Star}
              title="Оценить приложение"
              subtitle="Помогите нам улучшить приложение, оценив его"
              onPress={() => Alert.alert('Оценить приложение', 'Это откроет страницу рейтинга в магазине приложения')}
              color="#f59e0b"
            />
            <SettingsItem
              icon={Info}
              title="О Meter Reader"
              subtitle="Версия приложения и информация"
              onPress={handleAbout}
              color="#6b7280"
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Meter Reader v1.0.0
          </Text>
          <Text style={styles.footerSubtext}>
            Разработано с ❤️ React Native и Expo
          </Text>
        </View>
      </ScrollView>
      {/* Модальное окно выбора формата экспорта */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Экспорт данных</Text>
            <Text style={styles.modalSubtitle}>Выберите формат файла для экспорта</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButtonSave, { opacity: isExporting ? 0.6 : 1 }]}
                onPress={() => exportAndShare('json')}
                disabled={isExporting}
              >
                <Text style={styles.modalButtonTextSave}>JSON</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonSave, { backgroundColor: '#059669', opacity: isExporting ? 0.6 : 1 }]}
                onPress={() => exportAndShare('csv')}
                disabled={isExporting}
              >
                <Text style={styles.modalButtonTextSave}>CSV</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.modalButtonCancel} onPress={() => setExportModalVisible(false)} disabled={isExporting}>
              <Text style={styles.modalButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 32,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: '#ffffff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#e0e7ff',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#111827',
    marginBottom: 16,
  },
  sectionContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  destructiveItem: {
    borderBottomColor: '#fef2f2',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#111827',
    marginBottom: 4,
  },
  destructiveText: {
    color: '#ef4444',
  },
  itemSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6b7280',
  },
  footer: {
    alignItems: 'center',
    textAlign: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    marginBottom: 20,
  },
  footerText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  footerSubtext: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
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
    marginBottom: 8,
    color: '#111827',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  modalButtonSave: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  modalButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#111827',
  },
  modalButtonTextSave: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
});