import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { COLORS } from '../../src/constants/theme';

export default function OrderDetailPage() {
  const { colors, isDark } = useThemeStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { storeName, date } = useLocalSearchParams();
  const { household } = useAuthStore();
  const [items, setItems] = useState<any[]>([]);

  const cardBg = isDark ? colors.frost.bgHeavy : '#fff';

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    if (!household?.id) return;
    const dayStart = new Date(date as string);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date as string);
    dayEnd.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('purchase_history')
      .select('*')
      .eq('household_id', household.id)
      .eq('store_name', storeName)
      .gte('purchased_at', dayStart.toISOString())
      .lte('purchased_at', dayEnd.toISOString())
      .order('purchased_at', { ascending: true });

    if (data) setItems(data);
  };

  const total = items.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={[colors.background.start, colors.background.end]} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{storeName}</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={[styles.totalCard, { backgroundColor: cardBg }]}>
            <Text style={styles.totalLabel}>Order Total</Text>
            <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
            <Text style={styles.totalItems}>{items.length} items</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.itemRow, { backgroundColor: cardBg }]}>
            <Text style={styles.itemName}>{item.item_name || item.name || 'Item'}</Text>
            <Text style={styles.itemPrice}>${(item.price || 0).toFixed(2)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 22, color: COLORS.gold.base },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  totalCard: { borderRadius: 16, padding: 20, marginBottom: 16, alignItems: 'center' },
  totalLabel: { fontSize: 14, color: '#888', marginBottom: 4 },
  totalAmount: { fontSize: 36, fontWeight: '800', color: COLORS.gold.base },
  totalItems: { fontSize: 13, color: '#888', marginTop: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderRadius: 12, marginBottom: 8 },
  itemName: { fontSize: 15, flex: 1 },
  itemPrice: { fontSize: 15, fontWeight: '600', color: COLORS.gold.base },
});
