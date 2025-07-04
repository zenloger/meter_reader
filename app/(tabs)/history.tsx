import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Gauge, Trash2, TrendingUp, Filter } from 'lucide-react-native';
import { getStoredReadings, deleteReading } from '@/utils/storage';
import { MeterReading } from '@/types';

export default function HistoryTab() {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [filter, setFilter] = useState<'all' | 'electricity' | 'gas' | 'water'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReadings();
  }, []);

  const loadReadings = async () => {
    try {
      const storedReadings = await getStoredReadings();
      setReadings(storedReadings);
    } catch (error) {
      console.error('Error loading readings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReading = async (id: string) => {
    Alert.alert(
      'Удалить чтение',
      'Вы уверены, что хотите удалить это чтение?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteReading(id);
              await loadReadings();
            } catch (error) {
              console.error('Error deleting reading:', error);
            }
          }
        },
      ]
    );
  };

  const filteredReadings = readings.filter(reading => 
    filter === 'all' || reading.type === filter
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'electricity':
        return '#f59e0b';
      case 'gas':
        return '#ef4444';
      case 'water':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'electricity':
        return '⚡';
      case 'gas':
        return '🔥';
      case 'water':
        return '💧';
      default:
        return '📊';
    }
  };

  const FilterButton = ({ filterType, label }: { filterType: typeof filter; label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterType && styles.filterButtonActive
      ]}
      onPress={() => setFilter(filterType)}
      activeOpacity={0.8}
    >
      <Text style={[
        styles.filterButtonText,
        filter === filterType && styles.filterButtonTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Загрузка чтений...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2563eb', '#1d4ed8']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>История чтений</Text>
        <Text style={styles.headerSubtitle}>
          {readings.length} всего чтений
        </Text>
      </LinearGradient>

      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <Filter size={20} color="#6b7280" />
          <Text style={styles.filterLabel}>Фильтр по типу:</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <FilterButton filterType="all" label="Все" />
          <FilterButton filterType="electricity" label="Электричество" />
          <FilterButton filterType="gas" label="Газ" />
          <FilterButton filterType="water" label="Вода" />
        </ScrollView>
      </View>

      <ScrollView style={styles.readingsList} showsVerticalScrollIndicator={false}>
        {filteredReadings.length === 0 ? (
          <View style={styles.emptyState}>
            <Gauge size={64} color="#d1d5db" />
            <Text style={styles.emptyStateTitle}>Нет чтений</Text>
            <Text style={styles.emptyStateText}>
              {filter === 'all' 
                ? 'Сделайте свое первое чтение, чтобы начать'
                : `Нет ${filter} чтений`
              }
            </Text>
          </View>
        ) : (
          filteredReadings.map((reading) => (
            <View key={reading.id} style={styles.readingCard}>
              <View style={styles.readingHeader}>
                <View style={styles.readingInfo}>
                  <View style={styles.readingType}>
                    <Text style={styles.typeEmoji}>{getTypeIcon(reading.type)}</Text>
                    <Text style={[styles.typeText, { color: getTypeColor(reading.type) }]}>
                      {reading.type}
                    </Text>
                  </View>
                  <Text style={styles.readingValue}>
                    {reading.value} {reading.unit}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteReading(reading.id)}
                  activeOpacity={0.8}
                >
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>

              <View style={styles.readingDetails}>
                <View style={styles.detailRow}>
                  <Calendar size={16} color="#6b7280" />
                  <Text style={styles.detailText}>
                    {formatDate(reading.timestamp)} в {formatTime(reading.timestamp)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <TrendingUp size={16} color="#6b7280" />
                  <Text style={styles.detailText}>
                    Уверенность: {(reading.confidence * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>

              {reading.imageUri && (
                <Image source={{ uri: reading.imageUri }} style={styles.readingImage} />
              )}
            </View>
          ))
        )}
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
  filterContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterButtonText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  readingsList: {
    flex: 1,
    padding: 20,
  },
  readingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  readingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  readingInfo: {
    flex: 1,
  },
  readingType: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  typeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  readingValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#111827',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  readingDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  readingImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyStateTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 20,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingText: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 100,
  },
});