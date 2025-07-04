import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Trash2, Download, Info, CircleHelp as HelpCircle, Star } from 'lucide-react-native';
import { clearAllReadings } from '@/utils/storage';

export default function SettingsTab() {
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
    Alert.alert(
      'Экспорт данных',
      'Эта функция будет доступна в будущем обновлении. Вы сможете экспортировать свои показания в CSV или JSON.',
      [{ text: 'OK' }]
    );
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
});