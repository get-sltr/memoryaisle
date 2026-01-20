import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { MiraFloatingButton } from '../../src/components/MiraFloatingButton';
import { BottomTabBar } from '../../src/components/BottomTabBar';

export default function AppLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <BottomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'List',
          }}
        />
        <Tabs.Screen
          name="mealplan"
          options={{
            title: 'Plan',
          }}
        />
        <Tabs.Screen
          name="receipts"
          options={{
            title: 'Scan',
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: 'Favs',
          }}
        />
        <Tabs.Screen
          name="recipes"
          options={{
            title: 'Recipes',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: 'Family',
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
          }}
        />
        <Tabs.Screen
          name="trips"
          options={{
            title: 'Trips',
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
          }}
        />
        <Tabs.Screen
          name="upgrade"
          options={{
            title: 'Upgrade',
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: 'Wallet',
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Orders',
          }}
        />
        <Tabs.Screen
          name="prices"
          options={{
            title: 'Prices',
          }}
        />
        <Tabs.Screen
          name="meal-plans"
          options={{
            title: 'Meal Plans',
          }}
        />
        <Tabs.Screen
          name="mira"
          options={{
            title: 'Mira',
          }}
        />
        <Tabs.Screen
          name="checkout"
          options={{
            title: 'Checkout',
          }}
        />
      </Tabs>

      {/* Mira Floating Button - accessible from all screens */}
      <MiraFloatingButton />
    </View>
  );
}
