// Checkout redirects to upgrade page
// Payments are handled via App Store In-App Purchases

import { Redirect } from 'expo-router';

export default function CheckoutScreen() {
  // PERFORMANCE FIX: Using Expo Router's declarative Redirect component 
  // prevents momentary blank screens and mounts faster than a useEffect push.
  return <Redirect href="/(app)/upgrade" />;
}