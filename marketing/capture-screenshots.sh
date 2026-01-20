#!/bin/bash

# MemoryAisle App Store Screenshot Capture Script
# Usage: ./capture-screenshots.sh

# Screenshot output directory
OUTPUT_DIR="./screenshots"
mkdir -p "$OUTPUT_DIR"

echo "=========================================="
echo "MemoryAisle App Store Screenshot Capture"
echo "=========================================="

# Define devices and their screenshot sizes
# Format: "Device Name|Width|Height|Simulator Name"
DEVICES=(
  "iPhone_6.9|1320|2868|iPhone 16 Pro Max"
  "iPhone_6.7|1290|2796|iPhone 15 Pro Max"
  "iPhone_6.5|1242|2688|iPhone 14 Plus"
  "iPhone_5.5|1242|2208|iPhone 8 Plus"
  "iPad_12.9|2048|2732|iPad Pro (12.9-inch) (6th generation)"
  "iPad_11|1668|2388|iPad Pro (11-inch) (4th generation)"
)

# Screenshot names and descriptions
SCREENSHOTS=(
  "01_hero|Main shopping list with Mira AI"
  "02_voice|Voice command in action"
  "03_family|Family sharing feature"
  "04_mealplan|Meal planning calendar"
  "05_recipes|Recipe generation"
  "06_traditions|Traditions feature"
  "07_premium|Premium features overview"
)

echo ""
echo "Required screenshot screens:"
for screen in "${SCREENSHOTS[@]}"; do
  IFS='|' read -r name desc <<< "$screen"
  echo "  - $name: $desc"
done

echo ""
echo "Target devices:"
for device in "${DEVICES[@]}"; do
  IFS='|' read -r name width height simulator <<< "$device"
  echo "  - $name: ${width}x${height} ($simulator)"
done

echo ""
echo "=========================================="
echo "CAPTURE INSTRUCTIONS"
echo "=========================================="
echo ""
echo "1. Start the Expo development server:"
echo "   npx expo start"
echo ""
echo "2. Open iOS Simulator for each device:"
echo "   xcrun simctl list devices available | grep -E 'Pro Max|Plus|iPad Pro'"
echo ""
echo "3. For each screenshot, navigate to the screen and run:"
echo "   xcrun simctl io booted screenshot ~/Desktop/screenshot.png"
echo ""
echo "4. Or use Xcode: Device > Take Screenshot (Cmd+S)"
echo ""
echo "=========================================="
echo "AUTOMATED CAPTURE (requires Maestro)"
echo "=========================================="
echo ""

# Check if Maestro is installed
if command -v maestro &> /dev/null; then
  echo "Maestro found! You can use automated screenshot capture."
  echo ""
  echo "Run: maestro test marketing/screenshot-flows.yaml"
else
  echo "Maestro not installed. For automated screenshots, install with:"
  echo "  curl -Ls \"https://get.maestro.mobile.dev\" | bash"
fi

echo ""
echo "=========================================="
echo "MANUAL SCREENSHOT CHECKLIST"
echo "=========================================="
echo ""
echo "Open the app in simulator and capture these screens:"
echo ""
echo "1. HERO SHOT - Main List View"
echo "   - Show a populated shopping list"
echo "   - Include Mira AI button visible"
echo "   - Clean, organized items"
echo ""
echo "2. VOICE COMMAND"
echo "   - Show Mira listening/responding"
echo "   - Display voice waveform"
echo "   - Show a command being processed"
echo ""
echo "3. FAMILY SHARING"
echo "   - Show family tab or shared list"
echo "   - Display multiple family members"
echo "   - Show real-time sync indicator"
echo ""
echo "4. MEAL PLANNING"
echo "   - Show calendar view with meals"
echo "   - Display a week's worth of plans"
echo "   - Show recipe integration"
echo ""
echo "5. RECIPES"
echo "   - Show recipe generation in action"
echo "   - Display ingredients list"
echo "   - Show 'Add to List' action"
echo ""
echo "6. TRADITIONS"
echo "   - Show traditions tab"
echo "   - Display holiday icons/cards"
echo "   - Show a tradition's saved items"
echo ""
echo "7. PREMIUM FEATURES"
echo "   - Show upgrade screen"
echo "   - Display feature comparison"
echo "   - Highlight value proposition"
echo ""
echo "=========================================="

# Create directory structure for each device
for device in "${DEVICES[@]}"; do
  IFS='|' read -r name width height simulator <<< "$device"
  mkdir -p "$OUTPUT_DIR/$name"
  echo "Created: $OUTPUT_DIR/$name/"
done

echo ""
echo "Screenshot directories created."
echo "Place your captured screenshots in the appropriate folders."
