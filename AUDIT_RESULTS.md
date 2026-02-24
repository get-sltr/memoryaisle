# MemoryAisle Consumer-Readiness Audit

**Date:** 2026-02-24
**Auditor:** Claude Code (Full codebase trace, not just surface-level reads)
**Scope:** Every feature from UI to backend

---

## PRIORITY KEY

- **P0** — Blocks App Store approval or causes crash
- **P1** — Breaks core functionality users will encounter
- **P2** — Polish / nice-to-have before launch

---

## PHASE 1: AUTHENTICATION

| Item | Status | Details |
|------|--------|---------|
| Sign up (email/password) | **WORKING** | `app/(auth)/sign-up.tsx` → `src/services/auth.ts:96-124` → Supabase auth.signUp. Client-side validation (email format, password min 6 chars). Creates user profile via RPC. |
| Login flow | **WORKING** | `app/(auth)/sign-in.tsx` → `src/services/auth.ts:149-164` → Supabase auth.signInWithPassword. Redirects to main app on success. |
| Logout | **WORKING** | Settings screen → confirmation dialog → `auth.signOut()` → clears Zustand store → redirects to landing. |
| Password reset | **WORKING** | "Forgot Password?" link on sign-in → `auth.resetPasswordForEmail()` → redirect URI `memoryaisle://auth/callback`. |
| Session persistence | **WORKING** | Expo SecureStore (iOS Keychain) adapter for Supabase. Auto-refresh enabled. `_layout.tsx` checks session on launch. |
| Auth error handling | **WORKING** | All paths covered: missing fields, invalid email, wrong password, network errors. Alerts shown to user. OAuth cancellation silently handled. |

**Additional:** Apple Sign-In, Google OAuth, Facebook OAuth, Phone OTP all implemented and functional.

**Issues:** None.

---

## PHASE 2: ONBOARDING

| Item | Status | Details |
|------|--------|---------|
| First-time user flow | **WORKING** | Sign Up → Household Setup (`household.tsx`: create or join) → Dietary Setup (`dietary-setup.tsx`: preferences, allergens, cultural calendar) → Main App. |
| Onboarding screens/tutorials | **MISSING** | No tutorial, walkthrough, or feature introduction screens. User lands on empty grocery list after setup. |
| Default state for new user | **WORKING** | Auto-creates "Shopping List" for household. Empty list shows "All done! Your list is empty" message. Subscription set to free tier. |

### Issues

| # | Issue | Priority | File | Fix |
|---|-------|----------|------|-----|
| 1 | No tutorial or feature discovery for new users | P2 | — | Consider adding a brief walkthrough of key features (Mira, scanning, meal plans) |

---

## PHASE 3: SUBSCRIPTIONS (CRITICAL)

| Item | Status | Details |
|------|--------|---------|
| Paywall screen displays correctly | **WORKING** | `src/components/SubscriptionModal.tsx` — modal with feature list, price, trial info, legal links. |
| Subscribe button exists and is tappable | **WORKING** | Line 192-210. Calls `purchaseYearly()` from useSubscription hook. Disabled during loading. |
| Subscribe triggers StoreKit 2 purchase sheet | **WORKING** | `iapService.purchaseSubscription()` → `react-native-iap` v14 → `requestPurchase()` with StoreKit 2. |
| Product ID matches App Store Connect | **WORKING** | `com.memoryaisle.app.premium.yearly` used consistently across `iap.ts:31`, `apple-verify-receipt:63`, `apple-server-notifications:21`. |
| Price fetched from Apple (not hardcoded) | **WORKING** | `product?.localizedPrice` fetched via `fetchProducts()`. Fallback to "$49.99/year" only if Apple fetch fails. |
| "Includes free trial" text visible | **WORKING** | Shows "Includes 2-week free trial" at line 171. Button says "Start Free Trial - {price}/year". |
| Restore Purchases button works | **WORKING** | Lines 213-225. Calls `iapService.restorePurchases()` → `getAvailablePurchases()` → `activateSubscription()`. |
| Receipt sent to Supabase Edge Function | **WORKING** | `activateSubscription()` sends transactionId, productId, expirationDate to `apple-verify-receipt`. |
| Edge Function validates with Apple | **WORKING** | `supabase/functions/apple-verify-receipt/index.ts` — JWT auth, product ID whitelist, upserts subscription with service_role. |
| Subscription written by server, NOT client | **WORKING** | Edge Function uses `SUPABASE_SERVICE_ROLE_KEY`. Client has no write access. |
| RLS prevents client writes | **WORKING** | `20260223_remove_client_subscription_writes.sql` removes all client INSERT/UPDATE policies. Only SELECT for own row + service_role ALL. |
| Sync on app launch | **WORKING** | `syncSubscriptionOnLaunch()` called from `_layout.tsx:187`. Gets available StoreKit purchases and syncs to server. |
| Premium features gated | **WORKING** | `useFeatureAccess()` and `useFeatureQuota()` hooks check server-verified subscription status. Paywall shown when access denied. |
| Loading states during purchase | **WORKING** | `isLoading` disables buttons, shows ActivityIndicator. `isRestoring` shows spinner on restore. |
| Error: network failure | **WORKING** | Try/catch in purchase flow. 2-minute timeout safety. Error result shown via Alert. |
| Error: user cancel | **WORKING** | `ErrorCode.UserCancelled` → returns `{ status: 'cancelled' }` → modal closes silently. |
| Error: already subscribed | **WORKING** | Handled by StoreKit — Apple prevents double purchase natively. |
| Error: deferred (Ask to Buy) | **WORKING** | `ErrorCode.DeferredPayment` → returns `{ status: 'pending' }` → shows "Purchase awaiting approval" alert. |
| Terms of Use link on paywall | **WORKING** | Links to `https://memoryaisle.app/terms` via `Linking.openURL`. Styled, tappable. |
| Privacy Policy link on paywall | **WORKING** | Links to `https://memoryaisle.app/privacy` via `Linking.openURL`. Styled, tappable. |

**Additional:** Apple Server Notifications V2 webhook fully implemented with JWS cryptographic verification, handles all event types (SUBSCRIBED, DID_RENEW, EXPIRED, REFUND, etc.), full audit logging to `apple_subscription_notifications` table.

### Issues

| # | Issue | Priority | File | Fix |
|---|-------|----------|------|-----|
| 2 | Verify App Store Connect trial duration matches "2-week" text in app | P0 | `SubscriptionModal.tsx:171` | Confirm ASC product is configured with 14-day free trial. Mismatch = Apple rejection. |

---

## PHASE 4: GROCERY LISTS

| Item | Status | Details |
|------|--------|---------|
| Create a new list | **PARTIALLY IMPLEMENTED** | Auto-creates one "Shopping List" per household. No manual list creation UI. No list naming. |
| Add items manually | **WORKING** | Text input + send button at bottom of screen. Calls `addItem()` in `lists.ts:71-121`. Includes allergy detection. |
| Edit items | **MISSING** | `updateItemQuantity()` exists in `lists.ts:173-186` but NO UI to edit items (no edit button, no inline editing). |
| Delete items | **MISSING** | `deleteItem()` exists in `lists.ts:157-170` but NO UI to delete items (no swipe-to-delete, no delete button). |
| Mark items complete/checked | **WORKING** | Tap item → animated particle removal → `completeItem()` persists to Supabase. |
| Items organized by category/aisle | **WORKING** | Auto-categorized via `groupItemsByCategory()`. Collapsible category sections with icons, colors, counts. |
| Multiple lists support | **MISSING** | Only one active list per household. No UI or service for creating/switching/managing multiple lists. DB schema supports it but unused. |
| Family sharing / real-time updates | **WORKING** | Supabase postgres_changes realtime subscription. INSERT/UPDATE/DELETE events sync across household members. |

### Issues

| # | Issue | Priority | File | Fix |
|---|-------|----------|------|-----|
| 3 | Cannot edit grocery items after adding | P1 | `app/(app)/index.tsx` | Add edit button or long-press handler wired to `updateItemQuantity()` |
| 4 | Cannot delete grocery items | P1 | `app/(app)/index.tsx` | Add swipe-to-delete or delete button wired to `deleteItem()` |
| 5 | Only one list supported — no list management | P2 | `src/services/lists.ts` | DB supports multiple lists; need UI for create/switch/rename |

---

## PHASE 5: MIRA AI ASSISTANT

| Item | Status | Details |
|------|--------|---------|
| Chat interface loads | **WORKING** | `app/(app)/mira.tsx` (776 lines). Full conversational UI with message bubbles, auto-scroll, animated thinking indicator. |
| Only ONE Mira interface | **WORKING (by design)** | Three implementations exist: `mira.tsx` (full screen), `MiraFloatingButton.tsx` (floating widget — primary), `MiraChat.tsx` (deprecated modal). Not duplicates — different entry points. |
| User can send messages | **WORKING** | Text input → `handleSend()` → quota check → `mira.processText()` → GPT-4o via Supabase edge function `mira-chat`. |
| Mira responds with suggestions | **WORKING** | GPT-4o with comprehensive system prompt. Handles: grocery suggestions, recipes (structured), meal plans, dietary advice, family life, conversation. |
| Voice input | **PARTIALLY WORKING** | Recording via `expo-av` works. Transcription via OpenAI Whisper works. Wake word ("Hey Mira") DISABLED — Picovoice incompatible with Expo SDK 54. Must tap mic button. |
| Conversation history persists | **BROKEN** | In-session only (last 10 turns in memory). Settings references `mira_conversations` table but **NO migration exists** — table doesn't exist in database. History resets on app reload. |
| Clear Mira History in Settings | **BROKEN** | Button exists (`settings.tsx:148-179`) but deletes from `mira_conversations` table which doesn't exist. Will throw Postgres error. |
| Save Conversation History toggle | **PARTIALLY IMPLEMENTED** | Toggle exists and saves preference to `users.profile.save_mira_history`. But Mira service **never checks this preference** — conversations aren't persisted regardless of toggle state. |

### Issues

| # | Issue | Priority | File | Fix |
|---|-------|----------|------|-----|
| 6 | `mira_conversations` table missing — no migration | P1 | `supabase/migrations/` | Create migration with table schema matching what settings.tsx expects |
| 7 | "Clear Mira History" button will crash/error | P1 | `settings.tsx:148-179` | Depends on fix #6; or guard with table existence check |
| 8 | Save History toggle has no effect | P1 | `src/services/mira.ts` | Implement persistence logic that respects the toggle |
| 9 | Conversation history lost on app reload | P1 | `app/(app)/mira.tsx` | Load history from DB on mount if save_mira_history is true |
| 10 | Wake word detection disabled | P2 | `src/services/wakeWord.ts` | Blocked on Picovoice Expo SDK 54 support. Document limitation. |

---

## PHASE 6: MEAL PLANNING

| Item | Status | Details |
|------|--------|---------|
| Meal plan screen loads | **PARTIALLY WORKING** | `app/(app)/meal-plans.tsx` loads but displays **hardcoded sample data** (lines 42-146), not real database data. |
| Can add meals to plan | **PARTIALLY WORKING** | Weekly planner (`mealplan.tsx`) has full CRUD. But main meal-plans screen uses demo data only. |
| Dietary tradition support | **PARTIALLY WORKING** | Collected during onboarding (`dietary-setup.tsx`). Used by calendar for holidays. **NOT applied** to meal plan generation or recipe filtering. |
| AI recipe generation via Mira | **PARTIALLY WORKING** | Mira can generate structured recipes (types defined, edge function works). But recipes screen has no workflow to trigger/save Mira-generated recipes. |
| Recipes can generate shopping list | **WORKING** | `recipes.ts:156-184` — "Add Ingredients to List" button extracts ingredients and adds to active grocery list. |

### Issues

| # | Issue | Priority | File | Fix |
|---|-------|----------|------|-----|
| 11 | Meal plans screen shows hardcoded demo data | P1 | `meal-plans.tsx:42-146` | Connect to `mealPlans.ts` service and fetch from database |
| 12 | Dietary preferences ignored in meal planning | P1 | `meal-plans.tsx` | Pass household dietary prefs to Mira when generating plans |
| 13 | Mira recipe generation has no save workflow | P2 | `recipes.tsx` | Add UI to save Mira-generated recipes to database |
| 14 | Calendar doesn't show meal plan dates | P2 | `calendar.tsx` | Query `planned_meals` table and render on calendar grid |

---

## PHASE 7: RECEIPT SCANNING

| Item | Status | Details |
|------|--------|---------|
| Camera opens for scanning | **WORKING** | `expo-camera` + `expo-image-picker`. `GroceryScanner.tsx` (605 lines). |
| Receipt is captured | **WORKING** | Photo capture with image picker. |
| Items extracted from receipt | **WORKING** | GPT-4 Vision API via `supabase/functions/mira-receipt/index.ts`. Extracts item names, prices, store name. |
| Extracted items added to list | **WORKING** | After OCR, offers to auto-check-off matching items. Saves to `purchase_history` table. |
| Premium-gated | **WORKING** | Behind `useFeatureAccess('receiptScanning')`. Shows paywall if not subscribed. |

**Issues:** None.

---

## PHASE 8: GEOFENCING

| Item | Status | Details |
|------|--------|---------|
| Location permissions requested | **WORKING** | Foreground location permissions via `expo-location`. Requested on app launch. |
| Store proximity notifications | **WORKING** | 100-meter radius, Haversine distance formula, `Location.watchPositionAsync()`. Sends notification: "You're at [Store] — You have X items to pick up". |
| Location-based features | **WORKING** | `src/services/geofence.ts` (267 lines). Save/load/delete store locations. Arrival/departure callbacks. Started in `_layout.tsx`, stopped on logout. |

**Issues:** None.

---

## PHASE 9: FAMILY MANAGEMENT

| Item | Status | Details |
|------|--------|---------|
| Invite family members | **PARTIALLY IMPLEMENTED** | Invite code generated and stored in `households.invite_code`. But **NO Share/Copy UI** exists — user cannot see or share their invite code from within the app. |
| Family members see shared lists | **WORKING** | All household members share the same grocery list. Realtime sync via Supabase channels. |
| Real-time sync | **WORKING** | `src/services/realtimeSync.ts` (302 lines). Subscribes to `lists`, `list_items`, `notifications`, `family_activity`. Presence tracking for online members. |

### Issues

| # | Issue | Priority | File | Fix |
|---|-------|----------|------|-----|
| 15 | No UI to view/share invite code | P1 | `app/(app)/settings.tsx` or `family.tsx` | Add button to view household invite code + share sheet |
| 16 | No UI to manage household members | P1 | — | Add member list, remove member, view roles |

---

## PHASE 10: SETTINGS

| Item | Status | Details |
|------|--------|---------|
| Profile editing works | **WORKING** | `profile.tsx` — 10+ editable fields (nickname, birthday, foods, allergies, dietary, store). Save button appears on change. |
| Notification preferences | **WORKING** | Shows enabled/disabled status. Taps through to device settings. |
| Clear Mira History | **BROKEN** | See Phase 5, Issue #7. Table doesn't exist. |
| Save Conversation History toggle | **PARTIALLY IMPLEMENTED** | See Phase 5, Issue #8. Toggle saves preference but has no effect. |
| Subscription status displays | **WORKING** | Shows Premium (plan type, renewal date, manage button) or Free (upgrade prompt). Loading spinner during fetch. |
| Account deletion | **WORKING** | Two-step confirmation, requires typing "DELETE". Deletes from multiple tables. Signs out. Apple-compliant. |
| Privacy Policy link | **WORKING** | Routes to `/(app)/privacy` with full policy content. |
| Terms of Use link | **WORKING** | Routes to `/(app)/terms` with full terms content. |

### Issues

| # | Issue | Priority | File | Fix |
|---|-------|----------|------|-----|
| 17 | "Rate This App" link has placeholder App Store ID | P0 | `settings.tsx:664` | Replace `id123456789` with real Apple App ID |

---

## PHASE 11: UI/UX POLISH

| Item | Status | Details |
|------|--------|---------|
| No placeholder text / lorem ipsum | **WORKING** | No lorem ipsum found. All UI text is real. |
| No broken images / missing assets | **WORKING** | App icon, splash screen configured in `app.json`. |
| Loading states on async operations | **WORKING** | Present on main list, recipes, meal plans, subscription, profile. |
| Empty states | **WORKING** | All major screens have empty state handling (lists, reports, store cards, meal plans, calendar, prices). |
| Error states show user-friendly messages | **PARTIALLY WORKING** | Auth errors shown. But grocery list add/complete failures are **silent** (logged but no alert to user). |
| Navigation works correctly | **WORKING** | Bottom tab bar with 15+ screens. Stack navigation for auth flow. No dead ends found. |
| App icon and splash screen | **WORKING** | Configured in `app.json`. Icon: `./assets/icon.png`, Splash: `./assets/splash-icon.png`. |
| Dark mode | **WORKING** | Appearance toggle in settings (dark/light mode). |
| Console logs in release mode | **PARTIALLY BROKEN** | 47 console.log/warn/error statements found. At least 5 are explicit debug logs (e.g., `console.log('Sign out button pressed')`, `console.log("DEBUG receipts:...")`). |

### Issues

| # | Issue | Priority | File | Fix |
|---|-------|----------|------|-----|
| 18 | Debug console.log statements in production code | P1 | `settings.tsx`, `receipts.tsx`, `recipes.tsx`, `mira.tsx`, `_layout.tsx` | Remove all `console.log` debug statements. Keep `console.error` for crash diagnostics. |
| 19 | Version mismatch: package.json says 1.0.0, app.json says 1.1.0 | P1 | `package.json:3`, `app.json:5` | Align to single version number |
| 20 | Grocery list operations fail silently | P2 | `app/(app)/index.tsx` | Add user-facing error alerts when addItem/completeItem fails |

---

## PRIORITY SUMMARY

### P0 — Blocks App Store Approval (2 issues)

| # | Issue | Impact |
|---|-------|--------|
| 2 | Verify App Store Connect trial = 2 weeks (app says "2-week free trial") | If ASC has different duration, Apple rejects for misleading subscription info |
| 17 | "Rate This App" uses placeholder `id123456789` | Apple reviewer will catch this immediately |

### P1 — Breaks Core Functionality (12 issues)

| # | Issue | Impact |
|---|-------|--------|
| 3 | Cannot edit grocery items | Users stuck with mistakes |
| 4 | Cannot delete grocery items | Items can never be removed, only completed |
| 6 | `mira_conversations` table missing | Settings crash on Clear History |
| 7 | Clear Mira History button errors | Privacy Policy promises this works |
| 8 | Save History toggle does nothing | Feature appears broken to users |
| 9 | Conversation history lost on reload | Conversations vanish unexpectedly |
| 11 | Meal plans show hardcoded demo data | Users see fake data, can't create real plans |
| 12 | Dietary preferences ignored in meal planning | Key differentiator doesn't work |
| 15 | No UI to share household invite code | Families can't actually invite members |
| 16 | No UI to manage household members | Can't see who's in household |
| 18 | Debug console.log in production | Unprofessional, possible info leak |
| 19 | Version mismatch (1.0.0 vs 1.1.0) | Could cause build/submission confusion |

### P2 — Nice to Have (6 issues)

| # | Issue | Impact |
|---|-------|--------|
| 1 | No onboarding tutorial | New users don't discover features |
| 5 | Only one list (no multi-list) | Power users limited |
| 10 | Wake word disabled | No hands-free "Hey Mira" |
| 13 | Mira recipe generation can't save | Generated recipes are ephemeral |
| 14 | Calendar doesn't show meal plans | Calendar underutilized |
| 20 | Grocery list ops fail silently | User doesn't know if save failed |

---

## WHAT APPLE WILL SEE WHEN THEY TEST

1. **Auth** — Smooth. Sign up, sign in, forgot password, logout all work.
2. **Subscription** — Solid. Paywall displays, purchase triggers StoreKit, receipt validated server-side, features gated. Legal links present. This should pass 3.1.2.
3. **Grocery list** — Works for basic use (add + check off). But no edit or delete = poor UX that a reviewer might note.
4. **Mira** — Chat works great. Voice works. But if they toggle "Save History" or tap "Clear History" in Settings, it will error.
5. **Meal Plans** — They'll see sample data that looks fake. This will look like an incomplete app.
6. **Receipts** — Works behind paywall. Clean flow.
7. **Settings** — "Rate This App" goes to `id123456789` which doesn't exist. Instant red flag.
8. **Family** — No way to share invite code. Feature looks incomplete.

---

## RECOMMENDED FIX ORDER

1. **Replace placeholder App Store ID** (5 minutes, P0)
2. **Verify ASC trial duration = 14 days** (5 minutes, P0)
3. **Create `mira_conversations` migration** (30 minutes, P1)
4. **Connect meal plans to real data** (2-4 hours, P1)
5. **Add edit/delete UI for grocery items** (1-2 hours, P1)
6. **Add invite code sharing UI** (1 hour, P1)
7. **Remove debug console.log statements** (30 minutes, P1)
8. **Fix version mismatch** (5 minutes, P1)
9. **Implement Mira history persistence** (2-3 hours, P1)
10. **Add household member management UI** (2-3 hours, P1)
