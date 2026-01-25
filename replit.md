# MedAssist - Medical Assistant Mobile App

## Overview

MedAssist is a cross-platform mobile health tracking application built with React Native and Expo. The app helps users monitor their general health through monthly surveys, providing gentle suggestions for when medical checkups may be useful. The app does not diagnose medical conditions but tracks symptoms over time to identify patterns.

Key features include:
- Phone number OTP authentication
- Multi-language support (English and Hebrew with RTL layout)
- Monthly health surveys with symptom tracking and soft-delete capability
- Medical document upload with AI-powered data extraction
- AI-generated health recommendations with filtering options
- Smartwatch heart rate data import from HealthKit (iOS) and Health Connect (Android)
- Privacy-focused design suitable for all ages

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54
- **Navigation**: React Navigation v7 with native stack and bottom tabs
- **State Management**: React Context (AppContext) for global state, TanStack Query for server state
- **Styling**: React Native StyleSheet with themed components
- **Animations**: React Native Reanimated for smooth animations
- **Storage**: AsyncStorage for local persistence of user data, surveys, and preferences

### Authentication Flow
- **Registration**: First name, last name, 9-digit ID number, and phone number with OTP verification
- **Login**: Returning users login with ID + phone combination, verified via OTP
- **Real SMS OTP**: Uses Twilio API for SMS delivery; falls back to showing code on screen if Twilio fails
- **ID Security**: ID numbers are stored as hashed values, displayed masked (last 4 digits only)
- **Privacy Notice**: Users see privacy information during registration explaining ID usage and deletion rights
- User data stored locally with auto-generated UUID
- State resets synchronously on logout to prevent navigation race conditions

### Twilio SMS Integration
- **Required Secrets**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- OTP codes expire after 5 minutes
- If Twilio fails to send SMS (e.g., trial account limitations), the code is displayed on screen for testing
- Backend endpoints: `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`

### System Prompts (Admin Configurable)
- **Database Table**: `system_prompts`
- **Prompt Types**: `recommendations`, `document_extraction`
- **Languages**: `en` (English), `he` (Hebrew)
- **Admin API Endpoints**:
  - `GET /api/admin/system-prompts` - List all prompts
  - `GET /api/admin/system-prompts/:type/:language` - Get specific prompt
  - `PUT /api/admin/system-prompts/:type/:language` - Update prompt
- **Template Variables** (for recommendations prompt):
  - `{{hasSurveyData}}`, `{{surveyCount}}`, `{{hasDocumentData}}`
  - `{{hasDemographicData}}`, `{{existingTitlesList}}`, `{{criticalWarning}}`
- **Note**: Default prompts are seeded on server startup if not in database

### Heart Rate Data Import
- **Database Tables**: `heart_rate_samples`, `health_connections`
- **Data Sources**: HealthKit (iOS), Health Connect (Android)
- **Backend Endpoints**:
  - `POST /api/cardio/heart-rate/bulk` - Bulk upload heart rate samples
  - `GET /api/cardio/heart-rate` - Query heart rate data with date range filtering
  - `GET /api/cardio/heart-rate/stats` - Get statistics (avg, min, max, count)
  - `GET /api/cardio/connection` - Get health connection status
  - `DELETE /api/cardio/connection` - Disconnect health data source
- **UI**: WatchConnectionScreen accessible from Profile, shows connection status and heart rate stats
- **Note**: Full HealthKit/Health Connect integration requires device builds (not available in Expo Go)

### Navigation Structure
1. **Onboarding Stack** (unauthenticated users):
   - Language Selection → Login (with link to Register) → OTP Verification → Initial Survey (new users only)

2. **Main Tab Navigator** (authenticated users):
   - Home, Surveys, Suggestions, Profile tabs
   - Floating Action Button for monthly survey (modal presentation)

### Internationalization (i18n)
- Two languages: English (LTR) and Hebrew (RTL)
- Translations in `client/i18n/` directory
- RTL layout automatically applied for Hebrew
- Language persisted in AsyncStorage

### Backend Architecture
- **Runtime**: Node.js with Express
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Located in `shared/schema.ts`
- **Storage**: Currently using in-memory storage (`MemStorage`), ready for database integration
- **API**: RESTful endpoints prefixed with `/api`

### Project Structure
```
client/          # React Native app code
  components/    # Reusable UI components
  contexts/      # React Context providers
  hooks/         # Custom React hooks
  i18n/          # Translations (en.ts, he.ts)
  navigation/    # Navigation configuration
  screens/       # Screen components
  constants/     # Theme and design tokens

server/          # Express backend
  routes.ts      # API route definitions
  storage.ts     # Data storage interface

shared/          # Shared code between client/server
  schema.ts      # Drizzle database schema
```

## External Dependencies

### Core Dependencies
- **Expo**: Mobile app framework and build tooling
- **React Navigation**: Navigation library for React Native
- **TanStack Query**: Server state management and caching
- **Drizzle ORM**: TypeScript-first SQL ORM for database operations

### Database
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations and schema management

### UI/UX Libraries
- **expo-blur**: Blur effects for glass-style UI
- **expo-haptics**: Haptic feedback on native platforms
- **expo-image**: Optimized image component
- **react-native-reanimated**: Declarative animations
- **react-native-gesture-handler**: Touch gesture handling
- **react-native-keyboard-controller**: Keyboard-aware scrolling

### Storage & Localization
- **@react-native-async-storage/async-storage**: Persistent local storage
- **expo-localization**: Device locale detection

### Development Scripts
- `npm run expo:dev`: Start Expo development server
- `npm run server:dev`: Start Express backend in development
- `npm run db:push`: Push schema changes to database
- `npm run lint:fix`: Fix linting issues