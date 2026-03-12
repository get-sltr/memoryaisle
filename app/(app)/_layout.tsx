import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MiraFloatingButton } from '../../src/components/MiraFloatingButton';
import { BottomTabBar } from '../../src/components/BottomTabBar';

export default function AppLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        // PERFORMANCE FIX 1: Pass component reference directly to prevent re-renders
        tabBar={BottomTabBar}
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Primary tabs (visible in BottomTabBar) */}
        <Tabs.Screen name="index" options={{ title: 'List' }} />
        <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
        <Tabs.Screen name="receipts" options={{ title: 'Scan' }} />
        <Tabs.Screen name="favorites" options={{ title: 'Favs' }} />
        <Tabs.Screen name="settings" options={{ title: 'Menu' }} />

        {/* Non-tab screens (navigated to programmatically) */}
        {/* PERFORMANCE FIX 2: Added unmountOnBlur to hidden tabs to free up memory when not in use */}
        <Tabs.Screen name="mealplan" options={{ title: 'Plan', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="recipes" options={{ title: 'Recipes', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="family" options={{ title: 'Family', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="trips" options={{ title: 'Trips', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="admin" options={{ title: 'Admin', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="upgrade" options={{ title: 'Upgrade', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="store-cards" options={{ title: 'Store Cards', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="orders" options={{ title: 'Orders', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="prices" options={{ title: 'Prices', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="meal-plans" options={{ title: 'Meal Plans', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="checkout" options={{ title: 'Checkout', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="privacy" options={{ title: 'Privacy', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="terms" options={{ title: 'Terms', href: null, unmountOnBlur: true }} />
        <Tabs.Screen name="order-detail" options={{ title: 'Order Detail', href: null, unmountOnBlur: true }} />
      </Tabs>

      {/* Mira Floating Button - accessible from all screens */}
      <MiraFloatingButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});