# MemoryAisle

**The first grocery app that knows your family.**

MemoryAisle is an AI-powered grocery companion that learns every family member's allergies, dietary needs, cultural traditions, and food preferences — then builds personalized meal plans, grocery lists, and recipes around them. No more accidentally buying peanuts for your allergic child. No more guessing what's halal, kosher, or gluten-free.

**Website:** [memoryaisle.app](https://memoryaisle.app)

---

## The Problem

Grocery shopping for families is broken. The average American family wastes $1,500/year on food they don't eat. Parents with dietary restrictions, allergies, or cultural food requirements spend hours planning meals and triple-checking ingredients. Existing grocery apps are glorified to-do lists — they don't know your family, don't understand your needs, and don't adapt.

30+ million Americans are now on GLP-1 medications (Ozempic, Mounjaro, Wegovy) and have zero tools to plan meals around their weekly injection cycle. They Google "what to eat on Ozempic" and get generic listicles.

## The Solution

MemoryAisle replaces the mental load of feeding a family with an AI companion named **Mira** who:

- **Knows every family member** — allergies, intolerances, medications, preferences, and cultural dietary laws (halal, kosher, vegetarian, etc.)
- **Plans meals for days, weeks, or months** — with auto-generated grocery lists, calorie/macro tracking, and balanced nutrition
- **Adapts to GLP-1 medication cycles** — the first app to build meal plans around injection day, adjusting portions and food types to appetite suppression patterns *(launching as premium feature)*
- **Learns your traditions** — Taco Tuesday, Sunday roast, holiday recipes. Mira remembers and plans around them
- **Prevents dangerous mistakes** — never suggests a recipe containing a family member's allergen

## How It Works

1. **Set up your household** — add family members with their dietary needs, allergies, and preferences
2. **Talk to Mira** — ask for meal plans, recipes, or grocery suggestions in natural language
3. **Shop smarter** — auto-organized grocery lists by store aisle, geo-fenced reminders when you leave a store, receipt scanning for price tracking

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native / Expo (iOS + Android) |
| Language | TypeScript |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Realtime) |
| AI | GPT-4 via Supabase Edge Functions |
| Payments | StoreKit 2 (iOS), Google Play Billing |
| Infrastructure | AWS (Activate Founders credits secured) |
| Website | Cloudflare Workers |
| CI/CD | EAS Build + Submit |

## Key Features

- **Mira AI Assistant** — conversational grocery and meal planning powered by GPT-4, with full dietary/allergy awareness
- **Family Profiles** — up to 12 members per household with individual dietary needs
- **Meal Planning** — 7, 14, or 30-day plans with nutrition tracking
- **Smart Grocery Lists** — auto-categorized, real-time family sync, voice input
- **GLP-1 Adaptive Meal Planning** — cycle-aware meal plans for 30M+ Americans on weight-loss medications *(premium, in development)*
- **Geo-fencing** — store arrival/departure reminders so you never forget an item
- **Receipt Scanning** — track prices and spending patterns
- **Membership Card Storage** — all loyalty cards in one place

## Market

- **$1.1T** US grocery market
- **71%** of Americans use a grocery list (paper or digital)
- **32M** Americans on GLP-1 medications with zero meal-planning tools
- **"GLP-1 meal plan"** — 110K monthly search volume, 34,000%+ growth
- No competitor combines AI meal planning + family dietary safety + GLP-1 adaptation

## Business Model

Freemium subscription:
- **Free tier** — 10 Mira queries/day, basic lists, 1 family member
- **Premium** — unlimited Mira, full meal planning, receipt scanning, up to 12 family members, GLP-1 features

## Founder

**Kevin Minn** — Solo founder and CEO of SLTR Digital LLC (parent company). Former senior flight attendant for Emirates Airlines across Asia, the Middle East, and Europe. Immigrated to America, self-taught software development, and is currently maintaining a 4.0 GPA in Cybersecurity at Southern New Hampshire University while building MemoryAisle full-time. Author of "Remember My Name," an 85,000-word memoir.

Kevin builds production-grade applications at senior engineer level using Claude and Claude Code as his development team — architecture, implementation, and QA.

## Status

- iOS app built and in App Store review cycle
- Landing page live at [memoryaisle.app](https://memoryaisle.app)
- GLP-1 feature fully designed, database schema complete, in active development
- AWS Activate Founders credits secured

## Project Structure

```
app/                    # Expo Router screens
  (app)/                # Authenticated app screens
  (auth)/               # Authentication screens
src/
  components/           # Reusable UI components
  services/             # API services (auth, mira, iap, geofence, etc.)
  stores/               # Zustand state management
  hooks/                # Custom React hooks
  types/                # TypeScript type definitions
  utils/                # Utilities and helpers
supabase/
  functions/            # Edge Functions (mira-chat, apple-verify-receipt, etc.)
  migrations/           # Database migrations
assets/                 # App icons, splash screens, images
```

## Running Locally

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Build for iOS
eas build --platform ios

# Submit to App Store
eas submit --platform ios
```

Requires: Node.js 18+, Expo CLI, EAS CLI, Supabase project with environment variables configured.

## Contact

**Kevin Minn**
- Company: SLTR Digital LLC
- Website: [sltrdigital.com](https://sltrdigital.com)
- App: [memoryaisle.app](https://memoryaisle.app)

---

*Built with discipline, not shortcuts. Every line of code meets senior engineer standards: typed, secure, scalable, and tested.*
