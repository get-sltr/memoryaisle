// Checkout redirects to upgrade page
// Payments are handled via App Store In-App Purchases

import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function CheckoutScreen() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to upgrade page which handles IAP
    router.replace('/(app)/upgrade');
  }, []);

  return null;
}
