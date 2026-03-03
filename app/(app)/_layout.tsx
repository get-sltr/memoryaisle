import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { MiraFloatingButton } from '../../src/components/MiraFloatingButton';
import { BottomTabBar } from '../../src/components/BottomTabBar';

export default function AppLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        tabBar={(props) => <BottomTabBar {...props} />}
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
        <Tabs.Screen name="mealplan" options={{ title: 'Plan', href: null }} />
        <Tabs.Screen name="recipes" options={{ title: 'Recipes', href: null }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', href: null }} />
        <Tabs.Screen name="family" options={{ title: 'Family', href: null }} />
        <Tabs.Screen name="trips" options={{ title: 'Trips', href: null }} />
        <Tabs.Screen name="admin" options={{ title: 'Admin', href: null }} />
        <Tabs.Screen name="upgrade" options={{ title: 'Upgrade', href: null }} />
        <Tabs.Screen name="store-cards" options={{ title: 'Store Cards', href: null }} />
        <Tabs.Screen name="orders" options={{ title: 'Orders', href: null }} />
        <Tabs.Screen name="reports" options={{ title: 'Reports', href: null }} />
        <Tabs.Screen name="prices" options={{ title: 'Prices', href: null }} />
        <Tabs.Screen name="meal-plans" options={{ title: 'Meal Plans', href: null }} />
        <Tabs.Screen name="checkout" options={{ title: 'Checkout', href: null }} />
        <Tabs.Screen name="privacy" options={{ title: 'Privacy', href: null }} />
        <Tabs.Screen name="terms" options={{ title: 'Terms', href: null }} />
        <Tabs.Screen name="order-detail" options={{ title: 'Order Detail', href: null }} />
        <Tabs.Screen name="glp1-setup" options={{ title: 'GLP-1 Setup', href: null }} />
        <Tabs.Screen name="meal-memories" options={{ title: 'Memories', href: null }} />
        <Tabs.Screen name="blog" options={{ title: 'Blog', href: null }} />
        <Tabs.Screen name="pantry" options={{ title: 'Pantry', href: null }} />
        <Tabs.Screen name="budget" options={{ title: 'Budget', href: null }} />
        <Tabs.Screen name="cookbook" options={{ title: 'Cookbook', href: null }} />
        <Tabs.Screen name="holiday-planner" options={{ title: 'Holiday Planner', href: null }} />
        <Tabs.Screen name="barcode-scanner" options={{ title: 'Barcode Scanner', href: null }} />
        <Tabs.Screen name="community" options={{ title: 'Community', href: null }} />
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
