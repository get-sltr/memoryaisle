# App Store Submission Checklist for MemoryAisle

## Apple App Store Requirements

### 1. Apple Developer Account
- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Complete enrollment at https://developer.apple.com/programs/enroll/
- [ ] Verify your identity (individual or organization)

### 2. App Information (App Store Connect)
- [ ] **App Name**: MemoryAisle - Smart Grocery Shopping
- [ ] **Subtitle**: AI-Powered Grocery Companion
- [ ] **Primary Category**: Shopping
- [ ] **Secondary Category**: Food & Drink (optional)
- [ ] **Content Rating**: 4+ (no objectionable content)
- [ ] **Age Rating Questionnaire**: Complete in App Store Connect

### 3. App Description
```
MemoryAisle is your AI-powered grocery companion that makes shopping smarter and easier.

FEATURES:
• Mira AI Assistant - Voice commands for hands-free list management
• Smart Lists - Create and organize shopping lists effortlessly
• Family Sharing - Sync lists with up to 12 family members in real-time
• Meal Planning - Plan your week and auto-generate shopping lists
• Recipe Generation - Get personalized recipe suggestions
• Traditions - Remember holiday shopping lists and special occasions
• Store Geofencing - Your list appears when you arrive at the store
• Receipt Scanning - Track spending and improve suggestions

Start free and upgrade to Premium for unlimited access to all features.

SUBSCRIPTION OPTIONS:
• Free: 2 lists, 10 AI queries/day, 2 family members
• Premium Monthly: $9.99/month
• Premium Yearly: $47.88/year (Save 60%)

Privacy Policy: https://memoryaisle.app/privacy.html
Terms of Service: https://memoryaisle.app/terms.html
```

### 4. Keywords (100 characters max)
```
grocery,shopping,list,AI,assistant,family,meal,planning,recipes,traditions,smart,voice
```

### 5. Screenshots Required
| Device | Size | Quantity |
|--------|------|----------|
| iPhone 6.9" (Pro Max) | 1320 x 2868 | 3-10 screenshots |
| iPhone 6.7" | 1290 x 2796 | 3-10 screenshots |
| iPhone 6.5" | 1242 x 2688 | 3-10 screenshots |
| iPhone 5.5" | 1242 x 2208 | 3-10 screenshots |
| iPad Pro 12.9" | 2048 x 2732 | 3-10 screenshots |
| iPad Pro 11" | 1668 x 2388 | 3-10 screenshots |

**Screenshot suggestions:**
1. Hero shot - Main list view with Mira AI
2. Voice command in action
3. Family sharing feature
4. Meal planning calendar
5. Recipe generation
6. Traditions feature
7. Premium features overview

### 6. App Icon
- [ ] 1024 x 1024 px PNG (no transparency, no rounded corners)
- [ ] Icon should be visually distinct at small sizes
- [ ] No text in the icon

### 7. App Preview Video (Optional but Recommended)
- [ ] 15-30 seconds length
- [ ] Show key features in action
- [ ] Format: H.264, 30fps
- [ ] Resolution matches screenshot requirements

### 8. Privacy Requirements (CRITICAL)
- [x] **Privacy Policy URL**: https://memoryaisle.app/privacy.html
- [ ] **App Privacy Details** (Data Collection):
  - Contact Info (email) - Account creation
  - User Content (shopping lists) - App functionality
  - Identifiers (user ID) - App functionality
  - Usage Data - Analytics
  - Location (optional) - Geofencing feature

### 9. Account Deletion (REQUIRED)
- [x] **Account Deletion Page**: https://memoryaisle.app/delete-account.html
- [ ] In-app account deletion option in Settings
- [ ] Process deletion within 30 days

### 10. In-App Purchases
- [ ] Create IAP in App Store Connect:
  - `premium_monthly` - $9.99 Auto-Renewable Subscription
  - `premium_yearly` - $47.88 Auto-Renewable Subscription
- [ ] Subscription Group: "MemoryAisle Premium"
- [ ] Free trial: 3 days (configured in App Store Connect)
- [ ] Restore Purchases button in app

### 11. Export Compliance
- [ ] Does the app use encryption? **Yes** (HTTPS/TLS)
- [ ] Is it exempt from export compliance? **Yes** (standard encryption)
- [ ] Add `ITSAppUsesNonExemptEncryption: NO` to Info.plist

### 12. Sign in with Apple
- [x] Implemented Sign in with Apple (required if other social logins exist)

### 13. Build & Submit
- [ ] Create production build: `eas build --platform ios --profile production`
- [ ] Submit via EAS Submit: `eas submit --platform ios`
- [ ] Or upload via Xcode/Transporter

---

## Google Play Store Requirements

### 1. Google Play Developer Account
- [ ] Register at https://play.google.com/console
- [ ] Pay one-time $25 registration fee
- [ ] Complete identity verification

### 2. Store Listing
- [ ] **App Name**: MemoryAisle - Smart Grocery Shopping (50 chars max)
- [ ] **Short Description**: AI-powered grocery companion with voice commands and family sharing (80 chars max)
- [ ] **Full Description**: Same as App Store (4000 chars max)
- [ ] **Category**: Shopping
- [ ] **Content Rating**: Complete questionnaire (likely Everyone)

### 3. Graphics Assets
| Asset | Size |
|-------|------|
| App Icon | 512 x 512 px PNG |
| Feature Graphic | 1024 x 500 px |
| Screenshots (Phone) | Min 2, max 8 per device type |
| Screenshots (7" Tablet) | Optional |
| Screenshots (10" Tablet) | Optional |
| Promo Video | YouTube URL (optional) |

### 4. Privacy & Data Safety
- [ ] **Privacy Policy URL**: https://memoryaisle.app/privacy.html
- [ ] Complete Data Safety form:
  - Data collected: Email, Name, Shopping lists, Location (optional)
  - Data shared: None sold
  - Security practices: Encryption in transit, deletion available

### 5. App Content
- [ ] Ads Declaration: No ads
- [ ] Target Audience: Not primarily for children
- [ ] News App: No
- [ ] COVID-19 App: No

### 6. Account Deletion
- [ ] **Data Deletion URL**: https://memoryaisle.app/delete-account.html
- [ ] Describe data retention policy in Data Safety

### 7. In-App Purchases (Play Billing)
- [ ] Create subscriptions in Play Console:
  - Base plan: Monthly ($9.99)
  - Base plan: Yearly ($47.88)
- [ ] Subscription group: "premium"
- [ ] Free trial: 3 days

### 8. Build & Submit
- [ ] Create production build: `eas build --platform android --profile production`
- [ ] Generate AAB (Android App Bundle)
- [ ] Submit via Play Console or `eas submit --platform android`
- [ ] Set up internal/closed/open testing track first
- [ ] Promote to production after testing

---

## Pre-Submission Checklist

### Code Quality
- [ ] Remove all console.log statements
- [ ] Test on multiple device sizes
- [ ] Test offline functionality
- [ ] Test subscription flows end-to-end
- [ ] Test account deletion flow
- [ ] Verify all deep links work

### Legal
- [x] Privacy Policy published at https://memoryaisle.app/privacy.html
- [x] Terms of Service published at https://memoryaisle.app/terms.html
- [x] Account Deletion page at https://memoryaisle.app/delete-account.html
- [ ] Ensure GDPR compliance (EU users)
- [ ] Ensure CCPA compliance (California users)

### Marketing Website
- [x] Landing page (index.html)
- [x] Pricing page (pricing.html)
- [x] Privacy Policy (privacy.html)
- [x] Terms of Service (terms.html)
- [x] Account Deletion (delete-account.html)
- [ ] Deploy to https://memoryaisle.app

### Support
- [ ] Set up support email: support@memoryaisle.app
- [ ] Set up press email: press@memoryaisle.app
- [ ] Set up privacy email: privacy@memoryaisle.app
- [ ] Set up delete email: delete@memoryaisle.app

---

## App Review Notes Template

Use this template when submitting for review:

```
Demo Account (if login required):
Email: demo@memoryaisle.app
Password: [Create a demo account]

Subscription Testing:
- Use sandbox accounts for testing subscriptions
- Premium features can be tested with trial

Notes for Reviewer:
- This app requires an internet connection
- Location permission is optional (for store geofencing)
- Microphone permission is required for voice commands
- Sign in with Apple is available alongside Google and Facebook

Contact:
support@memoryaisle.app
```

---

## Timeline Estimate

1. **Developer Account Setup**: Same day to 1 week (identity verification)
2. **App Store Connect/Play Console Setup**: 1-2 days
3. **Screenshot Creation**: 1-2 days
4. **Build & Upload**: 1 day
5. **Review Process**:
   - Apple: 24 hours to 7 days (avg 1-2 days)
   - Google: 1-7 days (avg 2-3 days)

---

## Common Rejection Reasons to Avoid

### Apple
1. **Incomplete metadata** - Missing screenshots, descriptions
2. **Broken links** - Privacy policy URL not working
3. **Subscription issues** - Missing restore purchases, unclear pricing
4. **Guideline 4.2** - App doesn't have enough features (minimum viable product)
5. **Sign in with Apple** - Required if other social logins exist

### Google
1. **Data Safety incorrect** - Mismatch between declared and actual data collection
2. **Deceptive behavior** - Subscription pricing not clear
3. **Impersonation** - Using someone else's brand/trademark
4. **Broken functionality** - Crashes or major bugs
