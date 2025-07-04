import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, History, Gauge, TrendingUp } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { getStoredReadings } from '@/utils/storage';

export default function HomeTab() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalReadings: 0,
    thisMonth: 0,
    lastReading: null as string | null,
    trend: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);
  
  useFocusEffect(
    // useCallback нужен для оптимизации и предотвращения лишних вызовов
    // loadReadings будет вызываться при каждом фокусе экрана
    // eslint-disable-next-line react-hooks/exhaustive-deps
    React.useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    try {
      const readings = await getStoredReadings();
      const now = new Date();
      const currentMonth = now.getMonth();
      
      const thisMonthReadings = readings.filter(reading => 
        new Date(reading.timestamp).getMonth() === currentMonth
      );

      const lastReading = readings.length > 0 ? readings[0] : null;
      
      setStats({
        totalReadings: readings.length,
        thisMonth: thisMonthReadings.length,
        lastReading: lastReading ? `${lastReading.value} ${lastReading.unit}` : null,
        trend: thisMonthReadings.length > 0 ? 12 : 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statContent}>
        <View style={styles.statText}>
          <Text style={styles.statTitle}>{title}</Text>
          <Text style={styles.statValue}>{value}</Text>
          {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
        <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
          <Icon size={24} color={color} />
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <LinearGradient
        colors={['#2563eb', '#1d4ed8']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Meter Reader</Text>
        <Text style={styles.headerSubtitle}>Отслеживайте свои показания</Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.statsGrid}>
          <StatCard
            title="Всего чтений"
            value={stats.totalReadings}
            icon={Gauge}
            color="#2563eb"
          />
          <StatCard
            title="За этот месяц"
            value={stats.thisMonth}
            icon={TrendingUp}
            color="#059669"
          />
          <StatCard
            title="Последнее чтение"
            value={stats.lastReading || 'None'}
            subtitle={stats.lastReading ? 'Последнее' : 'Нет данных'}
            icon={History}
            color="#7c3aed"
          />
        </View>

        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Быстрые действия</Text>
          
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push('/(tabs)/camera')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#2563eb', '#1d4ed8']}
              style={styles.actionGradient}
            >
              <Camera size={24} color="#ffffff" />
              <Text style={styles.actionText}>Сделать новое чтение</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push('/(tabs)/history')}
            activeOpacity={0.8}
          >
            <History size={20} color="#2563eb" />
            <Text style={styles.secondaryActionText}>Просмотр истории</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Советы для лучших чтений</Text>
          <View style={styles.tipsList}>
            <View style={styles.tipItem}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>Убедитесь, что освещение хорошее при фотографировании</Text>
            </View>
            <View style={styles.tipItem}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>Центр дисплея в центре кадра</Text>
            </View>
            <View style={styles.tipItem}>
              <View style={styles.tipBullet} />
              <Text style={styles.tipText}>Удерживайте камеру стабильно для четких изображений</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
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
    padding: 20,
  },
  statsGrid: {
    marginBottom: 32,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statText: {
    flex: 1,
  },
  statTitle: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#111827',
    marginBottom: 2,
  },
  statSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: '#9ca3af',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  actionSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: '#111827',
    marginBottom: 16,
  },
  primaryAction: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  actionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#ffffff',
    marginLeft: 12,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  secondaryActionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#2563eb',
    marginLeft: 8,
  },
  tipsSection: {
    marginBottom: 32,
  },
  tipsList: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563eb',
    marginTop: 6,
    marginRight: 12,
  },
  tipText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#4b5563',
    flex: 1,
    lineHeight: 20,
  },
});