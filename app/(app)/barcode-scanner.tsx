import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ScreenWrapper } from '../../src/components/ScreenWrapper';
import { useAuthStore } from '../../src/stores/authStore';
import { usePantryStore } from '../../src/stores/pantryStore';
import { pantryService } from '../../src/services/pantry';
import { barcodeScannerService, type ScannedProduct } from '../../src/services/barcodeScanner';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../src/constants/theme';

export default function BarcodeScannerScreen() {
  const insets = useSafeAreaInsets();
  const { household } = useAuthStore();
  const { addItem: addToPantryStore } = usePantryStore();
  const [permission, requestPermission] = useCameraPermissions();

  const [isScanning, setIsScanning] = useState(true);
  const [isLooking, setIsLooking] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [manualName, setManualName] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [lastBarcode, setLastBarcode] = useState('');

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    const barcode = result.data;
    if (!isScanning || isLooking || barcode === lastBarcode) return;

    setIsScanning(false);
    setIsLooking(true);
    setLastBarcode(barcode);

    const product = await barcodeScannerService.lookupBarcode(barcode);

    if (product) {
      setScannedProduct(product);
      setManualName(product.product_name);
    } else {
      setScannedProduct(null);
      setManualName('');
      Alert.alert(
        'Product Not Found',
        `Barcode ${barcode} not in our database. Enter the product name manually.`,
      );
    }
    setIsLooking(false);
  };

  const handleAddToPantry = async () => {
    if (!household?.id || !manualName.trim()) return;

    const category = scannedProduct?.category || 'other';

    const result = await pantryService.addItem(household.id, {
      itemName: manualName.trim(),
      category,
      quantity: 1,
      unit: 'item',
    });

    if (result.success && result.item) {
      addToPantryStore(result.item);
      setScanCount((c) => c + 1);
      Alert.alert('Added!', `"${manualName.trim()}" added to your pantry.`, [
        {
          text: 'Scan Another',
          onPress: () => {
            setScannedProduct(null);
            setManualName('');
            setIsScanning(true);
          },
        },
        {
          text: 'Done',
          onPress: () => router.back(),
        },
      ]);
    } else {
      Alert.alert('Error', 'Failed to add item to pantry.');
    }
  };

  if (!permission) {
    return (
      <ScreenWrapper>
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.gold.base} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenWrapper>
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <Text style={styles.permissionEmoji}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            Allow camera access to scan product barcodes and quickly add items to your pantry.
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </Pressable>
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go Back</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera View */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.sm }]}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>Scan Barcode</Text>
            {scanCount > 0 && (
              <Text style={styles.scanCountText}>{scanCount} items added</Text>
            )}
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Scan Area Guide */}
        {isScanning && (
          <View style={styles.scanGuide}>
            <View style={styles.scanFrame}>
              <View style={[styles.scanCorner, styles.scanCornerTL]} />
              <View style={[styles.scanCorner, styles.scanCornerTR]} />
              <View style={[styles.scanCorner, styles.scanCornerBL]} />
              <View style={[styles.scanCorner, styles.scanCornerBR]} />
            </View>
            <Text style={styles.scanHint}>
              {isLooking ? 'Looking up product...' : 'Point at a barcode'}
            </Text>
            {isLooking && <ActivityIndicator color={COLORS.gold.base} style={{ marginTop: 12 }} />}
          </View>
        )}

        {/* Result Card */}
        {!isScanning && (
          <View style={[styles.resultCard, { paddingBottom: insets.bottom + SPACING.md }]}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.9)', 'rgba(250,248,245,0.85)']}
              style={StyleSheet.absoluteFill}
            />

            {scannedProduct?.image_url && (
              <Image source={{ uri: scannedProduct.image_url }} style={styles.productImage} />
            )}

            <Text style={styles.resultLabel}>
              {scannedProduct ? 'Product Found' : 'Enter Product Name'}
            </Text>

            <TextInput
              style={styles.resultInput}
              value={manualName}
              onChangeText={setManualName}
              placeholder="Product name"
              placeholderTextColor={COLORS.text.secondary}
              autoFocus={!scannedProduct}
            />

            {scannedProduct?.brand && (
              <Text style={styles.resultBrand}>{scannedProduct.brand}</Text>
            )}

            {scannedProduct?.category && (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{scannedProduct.category}</Text>
              </View>
            )}

            <View style={styles.resultButtons}>
              <Pressable style={styles.addButton} onPress={handleAddToPantry} disabled={!manualName.trim()}>
                <LinearGradient colors={[COLORS.gold.light, COLORS.gold.base]} style={StyleSheet.absoluteFill} />
                <Text style={styles.addButtonText}>Add to Pantry</Text>
              </Pressable>

              <Pressable
                style={styles.scanAgainButton}
                onPress={() => {
                  setScannedProduct(null);
                  setManualName('');
                  setIsScanning(true);
                }}
              >
                <Text style={styles.scanAgainText}>Scan Another</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },

  // Permission screen
  permissionEmoji: { fontSize: 56, marginBottom: SPACING.md },
  permissionTitle: { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text.primary, marginBottom: SPACING.sm },
  permissionText: { fontSize: FONT_SIZES.md, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.xl },
  permissionButton: { height: 48, width: 200, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  permissionButtonText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: '#fff' },
  backLink: { marginTop: SPACING.lg },
  backLinkText: { fontSize: FONT_SIZES.md, color: COLORS.gold.dark, fontWeight: '500' },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  closeButtonText: { fontSize: 18, color: '#fff', fontWeight: '600' },
  topBarCenter: { alignItems: 'center' },
  topBarTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: '#fff' },
  scanCountText: { fontSize: FONT_SIZES.xs, color: COLORS.gold.light, marginTop: 2 },

  // Scan guide
  scanGuide: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  scanFrame: { width: 260, height: 160, position: 'relative' },
  scanCorner: { position: 'absolute', width: 30, height: 30, borderColor: COLORS.gold.base },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scanHint: { fontSize: FONT_SIZES.md, color: '#fff', marginTop: SPACING.lg, fontWeight: '500' },

  // Result card
  resultCard: { borderTopLeftRadius: BORDER_RADIUS.xl, borderTopRightRadius: BORDER_RADIUS.xl, overflow: 'hidden', padding: SPACING.lg },
  productImage: { width: 80, height: 80, borderRadius: BORDER_RADIUS.md, alignSelf: 'center', marginBottom: SPACING.sm },
  resultLabel: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, fontWeight: '600', marginBottom: SPACING.xs },
  resultInput: { backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2, fontSize: FONT_SIZES.lg, color: COLORS.text.primary, fontWeight: '600', marginBottom: SPACING.xs },
  resultBrand: { fontSize: FONT_SIZES.sm, color: COLORS.text.secondary, marginBottom: SPACING.xs },
  categoryChip: { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.gold.lightest, marginBottom: SPACING.md },
  categoryChipText: { fontSize: FONT_SIZES.xs, color: COLORS.gold.dark, fontWeight: '600' },
  resultButtons: { gap: SPACING.sm },
  addButton: { height: 48, borderRadius: BORDER_RADIUS.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...SHADOWS.goldGlow },
  addButtonText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: '#fff' },
  scanAgainButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  scanAgainText: { fontSize: FONT_SIZES.md, color: COLORS.gold.dark, fontWeight: '600' },
});
