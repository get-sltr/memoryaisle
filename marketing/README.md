# MemoryAisle App Store Marketing Assets

## Screenshot Requirements

### iOS App Store

| Device | Dimensions | Required |
|--------|------------|----------|
| iPhone 6.9" (Pro Max) | 1320 x 2868 | Yes |
| iPhone 6.7" | 1290 x 2796 | Yes |
| iPhone 6.5" | 1242 x 2688 | Yes |
| iPhone 5.5" | 1242 x 2208 | Optional |
| iPad Pro 12.9" | 2048 x 2732 | Yes (if supporting iPad) |
| iPad Pro 11" | 1668 x 2388 | Optional |

### Google Play Store

| Asset | Dimensions |
|-------|------------|
| Screenshots (Phone) | Min 320px, Max 3840px |
| Screenshots (7" Tablet) | Optional |
| Screenshots (10" Tablet) | Optional |
| Feature Graphic | 1024 x 500 |

## Screenshot Screens to Capture

1. **Hero Shot** - Main shopping list view with Mira AI button
2. **Voice Command** - Mira listening/responding to voice
3. **Family Sharing** - Family tab showing shared members
4. **Meal Planning** - Calendar view with meal plans
5. **Recipe Generation** - Recipe suggestions screen
6. **Traditions** - Holiday traditions feature
7. **Premium Features** - Upgrade/subscription screen

## How to Capture Screenshots

### Method 1: iOS Simulator (Recommended)

1. Start the Expo dev server:
   ```bash
   npx expo start
   ```

2. Open iOS Simulator with target device:
   ```bash
   # List available simulators
   xcrun simctl list devices available | grep -E 'Pro Max|Plus|iPad Pro'

   # Boot a specific simulator
   xcrun simctl boot "iPhone 16 Pro Max"
   ```

3. Run the app in the simulator:
   Press `i` in Expo to open iOS simulator

4. Navigate to each screen and capture:
   ```bash
   # Take screenshot
   xcrun simctl io booted screenshot ~/Desktop/screenshot.png
   ```

   Or use Xcode: **Window > Devices and Simulators > Take Screenshot**

### Method 2: Physical Device

1. Connect your iPhone/iPad
2. Open the app and navigate to each screen
3. Press **Side Button + Volume Up** to capture
4. AirDrop or transfer screenshots to computer

## Adding Marketing Frames

After capturing raw screenshots:

1. Place raw screenshots in `screenshots/{device}/` folders
2. Install dependencies:
   ```bash
   npm install sharp canvas
   ```
3. Run the frame generator:
   ```bash
   node create-frames.js
   ```
4. Framed screenshots will be in `framed/{device}/`

## Directory Structure

```
marketing/
├── screenshots/           # Raw screenshots from simulators
│   ├── iPhone_6.9/
│   ├── iPhone_6.7/
│   ├── iPhone_6.5/
│   ├── iPhone_5.5/
│   ├── iPad_12.9/
│   └── iPad_11/
├── framed/               # Screenshots with marketing frames
│   └── [same structure]
├── capture-screenshots.sh
├── create-frames.js
└── README.md
```

## File Naming Convention

Name your screenshots:
- `01_hero.png`
- `02_voice.png`
- `03_family.png`
- `04_mealplan.png`
- `05_recipes.png`
- `06_traditions.png`
- `07_premium.png`

## Marketing Copy

Each screenshot includes:

| Screenshot | Headline | Subheadline |
|------------|----------|-------------|
| Hero | Smart Grocery Shopping | AI-powered lists that learn your preferences |
| Voice | Just Speak. Mira Listens. | Hands-free voice commands with Mira AI |
| Family | Shop Together, Apart | Real-time sync with up to 12 family members |
| Meal Plan | Plan Your Week | AI-generated meal plans and grocery lists |
| Recipes | Recipes That Fit Your Life | Personalized suggestions based on preferences |
| Traditions | Remember Every Tradition | Holiday shopping lists saved and ready |
| Premium | Unlimited Possibilities | Premium features for power shoppers |

## App Icon

- **Size**: 1024 x 1024 px
- **Format**: PNG, no transparency
- **Location**: `assets/icon.png`

Requirements:
- No rounded corners (Apple applies automatically)
- No text in icon
- Clear at small sizes (29x29, 40x40, 60x60)

## App Preview Video (Optional)

- **Duration**: 15-30 seconds
- **Format**: H.264, MOV or MP4
- **Frame Rate**: 30fps
- **Resolution**: Match screenshot sizes

Show:
1. Adding items with voice
2. Real-time family sync
3. Mira AI conversation
4. Meal plan generation

## Checklist

- [ ] Capture screenshots for iPhone 6.9"
- [ ] Capture screenshots for iPhone 6.7"
- [ ] Capture screenshots for iPhone 6.5"
- [ ] Capture screenshots for iPad Pro 12.9" (if needed)
- [ ] Run frame generator
- [ ] Review framed screenshots
- [ ] Upload to App Store Connect
- [ ] Create Feature Graphic for Google Play (1024x500)
