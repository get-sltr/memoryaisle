// Grocery Scanner Component
// Camera-based object detection for identifying grocery items

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
  FadeInUp,
  SlideInUp,
} from 'react-native-reanimated';
import { logger } from '../utils/logger';
import {
  objectDetectionService,
  DetectedItem,
  DetectionResult,
} from '../services/objectDetection';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCANNER_SIZE = SCREEN_WIDTH - 80;

interface GroceryScannerProps {
  onItemsDetected: (items: DetectedItem[]) => void;
  onClose: () => void;
  mode?: 'scan' | 'receipt';
}

export function GroceryScanner({
  onItemsDetected,
  onClose,
  mode = 'scan',
}: GroceryScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [scanResult, setScanResult] = useState<DetectionResult | null>(null);
  const [flashEnabled, setFlashEnabled] = useState(false);

  const cameraRef = useRef<CameraView>(null);

  // Animation values
  const scanLinePosition = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const cornerGlow = useSharedValue(0.5);

  // Start scanner animation
  useEffect(() => {
    // Scanning line animation
    scanLinePosition.value = withRepeat(
      withTiming(1, { duration: 2000 }),
      -1,
      true
    );

    // Pulse animation
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );

    // Corner glow animation
    cornerGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500 }),
        withTiming(0.5, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: scanLinePosition.value * (SCANNER_SIZE - 4) },
    ],
    opacity: 0.8,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const cornerStyle = useAnimatedStyle(() => ({
    opacity: cornerGlow.value,
  }));

  // Take photo and process
  const handleCapture = useCallback(async () => {
    if (isScanning || !cameraRef.current) return;

    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (!photo?.uri) {
        throw new Error('Failed to capture image');
      }

      let result: DetectionResult;

      if (mode === 'receipt') {
        result = await objectDetectionService.detectFromReceipt(photo.uri);
      } else {
        result = await objectDetectionService.detectFromImage(photo.uri);
      }

      setScanResult(result);

      if (result.success && result.items.length > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setDetectedItems(result.items);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (error) {
      logger.error('Scan error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsScanning(false);
    }
  }, [mode, isScanning]);

  // Confirm detected items
  const handleConfirm = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onItemsDetected(detectedItems);
    onClose();
  }, [detectedItems, onItemsDetected, onClose]);

  // Reset scan
  const handleRescan = useCallback(() => {
    setDetectedItems([]);
    setScanResult(null);
  }, []);

  // Toggle flash
  const toggleFlash = useCallback(() => {
    setFlashEnabled(!flashEnabled);
    Haptics.selectionAsync();
  }, [flashEnabled]);

  // Permission not granted
  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <LinearGradient
          colors={['#0a0a0f', '#1a1a2e']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          Allow camera access to scan groceries and receipts
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <LinearGradient
            colors={['#00D4AA', '#00B4D8']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </Pressable>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        enableTorch={flashEnabled}
      >
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Header */}
          <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
            <Pressable style={styles.headerButton} onPress={onClose}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={styles.headerButtonText}>×</Text>
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {mode === 'receipt' ? 'Scan Receipt' : 'Scan Groceries'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {mode === 'receipt'
                  ? 'Point at your receipt'
                  : 'Point at items to detect'}
              </Text>
            </View>

            <Pressable style={styles.headerButton} onPress={toggleFlash}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={styles.flashIcon}>{flashEnabled ? '⚡' : '🔦'}</Text>
            </Pressable>
          </Animated.View>

          {/* Scanner frame */}
          <View style={styles.scannerWrapper}>
            <Animated.View style={[styles.scannerFrame, pulseStyle]}>
              {/* Corners */}
              <Animated.View style={[styles.corner, styles.cornerTL, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.cornerTR, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.cornerBL, cornerStyle]} />
              <Animated.View style={[styles.corner, styles.cornerBR, cornerStyle]} />

              {/* Scan line */}
              <Animated.View style={[styles.scanLine, scanLineStyle]}>
                <LinearGradient
                  colors={['transparent', '#00D4AA', 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.scanLineGradient}
                />
              </Animated.View>
            </Animated.View>
          </View>

          {/* Results panel */}
          {detectedItems.length > 0 ? (
            <Animated.View
              entering={SlideInUp.duration(400)}
              style={styles.resultsPanel}
            >
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

              <View style={styles.resultsContent}>
                <Text style={styles.resultsTitle}>
                  {detectedItems.length} item{detectedItems.length !== 1 ? 's' : ''} detected
                </Text>

                <View style={styles.itemsList}>
                  {detectedItems.slice(0, 6).map((item, index) => (
                    <View key={index} style={styles.itemChip}>
                      <View
                        style={[
                          styles.itemConfidence,
                          { backgroundColor: getConfidenceColor(item.confidence) },
                        ]}
                      />
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCategory}>{item.category}</Text>
                    </View>
                  ))}
                  {detectedItems.length > 6 && (
                    <View style={styles.moreChip}>
                      <Text style={styles.moreText}>+{detectedItems.length - 6}</Text>
                    </View>
                  )}
                </View>

                {scanResult?.suggestions && scanResult.suggestions.length > 0 && (
                  <View style={styles.suggestions}>
                    <Text style={styles.suggestionText}>
                      {scanResult.suggestions[0]}
                    </Text>
                  </View>
                )}

                <View style={styles.resultsActions}>
                  <Pressable style={styles.rescanButton} onPress={handleRescan}>
                    <Text style={styles.rescanButtonText}>Scan Again</Text>
                  </Pressable>

                  <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                    <LinearGradient
                      colors={['#00D4AA', '#00B4D8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.confirmButtonText}>Add to List</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ) : (
            /* Capture button */
            <View style={styles.captureWrapper}>
              <Pressable
                style={styles.captureButton}
                onPress={handleCapture}
                disabled={isScanning}
              >
                <LinearGradient
                  colors={['#00D4AA', '#00B4D8']}
                  style={StyleSheet.absoluteFill}
                />
                {isScanning ? (
                  <ActivityIndicator size="large" color="#FFFFFF" />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </Pressable>

              <Text style={styles.captureHint}>
                {mode === 'receipt' ? 'Tap to scan receipt' : 'Tap to capture'}
              </Text>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}

// Helper function for confidence colors
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return '#00D4AA';
  if (confidence >= 0.6) return '#F59E0B';
  return '#EF4444';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  permissionTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.md,
  },
  permissionText: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  permissionButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  permissionButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.white,
  },
  closeButton: {
    padding: SPACING.md,
  },
  closeButtonText: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerButtonText: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: '300',
  },
  flashIcon: {
    fontSize: 20,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '600',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  scannerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#00D4AA',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
  },
  scanLineGradient: {
    flex: 1,
  },
  captureWrapper: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  captureHint: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: SPACING.md,
  },
  resultsPanel: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  resultsContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  resultsTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.md,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  itemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: 6,
  },
  itemConfidence: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  itemCategory: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'capitalize',
  },
  moreChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  moreText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.white,
  },
  suggestions: {
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  suggestionText: {
    fontSize: FONT_SIZES.sm,
    color: '#00D4AA',
    fontStyle: 'italic',
  },
  resultsActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  rescanButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  rescanButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  confirmButton: {
    flex: 2,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    overflow: 'hidden',
  },
  confirmButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
});
