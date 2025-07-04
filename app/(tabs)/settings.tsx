import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Trash2, Download, Info, CircleHelp as HelpCircle, Star } from 'lucide-react-native';
import { clearAllReadings } from '@/utils/storage';

export default function SettingsTab() {
  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all meter readings? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete All', 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllReadings();
              Alert.alert('Success', 'All readings have been deleted.');
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          }
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'This feature will be available in a future update. You\'ll be able to export your readings as CSV or JSON.',
      [{ text: 'OK' }]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'About Meter Reader',
      'Version 1.0.0\n\nA smart utility meter reading app with AI-powered image analysis.\n\nBuilt with React Native and Expo.',
      [{ text: 'OK' }]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      'Help & Support',
      '1. Point your camera at the meter display\n2. Ensure good lighting\n3. Keep the numbers centered\n4. Tap the capture button\n\nFor best results, take photos in well-lit conditions.',
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
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your app preferences</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={Download}
              title="Export Data"
              subtitle="Save your readings as CSV or JSON"
              onPress={handleExportData}
              color="#059669"
            />
            <SettingsItem
              icon={Trash2}
              title="Clear All Data"
              subtitle="Delete all stored readings"
              onPress={handleClearData}
              color="#ef4444"
              destructive
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon={HelpCircle}
              title="Help & Tips"
              subtitle="Learn how to take better readings"
              onPress={handleHelp}
              color="#7c3aed"
            />
            <SettingsItem
              icon={Star}
              title="Rate App"
              subtitle="Help us improve by rating the app"
              onPress={() => Alert.alert('Rate App', 'This would open the app store rating page.')}
              color="#f59e0b"
            />
            <SettingsItem
              icon={Info}
              title="About"
              subtitle="App version and information"
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
            Made with ❤️ using React Native & Expo
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
    paddingTop: 40,
    paddingBottom: 20,
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
  },
});