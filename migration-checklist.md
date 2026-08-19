# Supabase to Firebase Migration Checklist & Architecture Reference

## Overview
This document tracks all references, components, and workflows in the LocalEats platform being transitioned from Supabase to Google Firebase (Firestore, Firebase Authentication, Firebase Storage, and Firebase Cloud Messaging).

---

## 1. Supabase Usage Discovery & Status

| Category | File Path | Usage Details | Migration Status |
| :--- | :--- | :--- | :--- |
| **Auth** | `src/App.tsx` | User Login, Registration, Session restoration, Password Reset |  **Migrated to Firebase Auth** |
| **Auth Overlay** | `src/components/ui/FirebaseInitializingOverlay.tsx` | Global loading overlay during Firebase SDK initialization |  **Implemented** |
| **Storage (Logos)** | `src/App.tsx` (Storefront Profile) | Shop logo upload to storage bucket |  **Migrated to Firebase Storage** |
| **Storage (Avatars)** | `src/App.tsx` (EditProfile) | Avatar and shop photo upload |  **Migrated to Firebase Storage** |
| **Data Migration** | `src/lib/firebase.ts` & `src/components/FirebaseMigrationModal.tsx` | Migration utility for Orders, Menu Items, & Shops from local state/cache to Firestore |  **Implemented** |
| **Auth Types** | `src/types.ts` | Local `User` interface decoupled from `@supabase/supabase-js` |  **Decoupled** |
| **Diagnostics** | `src/components/DiagnosticUtilityModal.tsx` | Network and database telemetry | 🟡 Supabase channel diagnostics active for legacy fallback |
| **Database Sync** | `src/hooks/useAppInitializer.ts`, `src/hooks/useOrderWorkflow.ts` | Orders and Menus live queries | 🟡 Resilient multi-tier mode (Firestore + local offline cache) |
| **Rider & Client Apps**| Cross-app ecosystem | Client Storefront, Rider Deliveries, Merchant Admin Prompts |  **Generated & Structured** |

---

## 2. Firebase Configuration Details
- **Project ID**: `gen-lang-client-0863469023`
- **Firestore Database ID**: `ai-studio-localeatsvendord-a61b068b-3029-4d93-ba41-626b03a23bbe`
- **Storage Bucket**: `gen-lang-client-0863469023.firebasestorage.app`
- **Auth Domain**: `gen-lang-client-0863469023.firebaseapp.com`

---

## 3. Migration Instructions for Remaining Apps

### A. Client Storefront App
- **Authentication**: Anonymous or Phone/Email Firebase Auth.
- **Firestore Collections**:
  - `shops/{shopId}`: Reads shop profile, location, operating hours, trust badges.
  - `menu_items`: Queried by `where("shop_id", "==", shopId)` and `where("is_available", "==", true)`.
  - `orders`: Created with unique ID, status `pending`, delivery fee, customer coordinates, and phone.

### B. Rider Deliveries App
- **Authentication**: Firebase Auth with role `rider`.
- **Firestore Collections**:
  - `rider_profiles/{riderId}`: Live GPS coordinates (`current_latitude`, `current_longitude`), online status toggle.
  - `orders`: Queried by `where("delivery_status", "in", ["finding_rider", "accepted", "picked_up"])`.
  - `shop_connections`: Pairing cipher verification with shops.

### C. Admin & Operations Portal
- **Authentication**: Firebase Auth with role `admin`.
- **Firestore Queries**:
  - Global aggregation across `shops`, `orders`, and `rider_profiles`.
  - Batch payouts and delivery radius configurations.
