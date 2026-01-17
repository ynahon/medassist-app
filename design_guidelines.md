# Medical Assistant App - Design Guidelines

## Architecture Decisions

### Authentication
**Required** - Phone number OTP verification is mandatory before app access.

**Implementation:**
- Phone authentication with SMS OTP (6-digit code)
- Registration flow captures: First Name, Last Name, Phone Number
- User ID auto-generated after verification
- No email/password option
- Mock OTP flow in prototype (auto-fill "123456" for testing)
- Include privacy policy & terms links on registration screen

### Navigation
**Tab Navigation** (4 tabs + floating action button for monthly survey)

**Tab Structure:**
1. **Home** - Health summary and timeline
2. **Surveys** - Survey history and results
3. **[FAB]** - Start Monthly Survey (floating action button, centered)
4. **Suggestions** - Health recommendations
5. **Profile** - Settings, language, account management

**Additional Flows:**
- Stack-only: Onboarding (language selection → registration → first survey)
- Modal: Survey completion screens, language switcher

### Screen Specifications

#### 1. Language Selection (First Launch Only)
- **Purpose:** User selects preferred language (English/Hebrew)
- **Layout:**
  - No header
  - Centered vertical layout
  - App logo/icon at top
  - Two large language cards: "English (LTR)" and "עברית (RTL)"
  - Safe area: top: insets.top + 60, bottom: insets.bottom + 40
- **Components:** Large touchable cards with flag icons and language names

#### 2. Phone Registration
- **Purpose:** Capture user details and verify phone
- **Layout:**
  - Default navigation header (transparent), back button
  - Scrollable form
  - Submit button below form (not in header)
  - Safe area: top: headerHeight + Spacing.xl, bottom: insets.bottom + Spacing.xl
- **Components:** 
  - Text inputs: First Name, Last Name, Phone Number (with country code picker)
  - Large primary button: "Send Verification Code"
  - Links: Terms & Privacy (small, bottom)

#### 3. OTP Verification
- **Purpose:** Verify phone number
- **Layout:**
  - Default navigation header, back button
  - Centered content (non-scrollable)
  - 6-digit OTP input boxes
  - Resend timer (60 seconds)
  - Safe area: top: headerHeight + Spacing.xl
- **Components:** Individual OTP input boxes, countdown text, resend link

#### 4. First Health Survey (Onboarding)
- **Purpose:** Capture baseline health data
- **Layout:**
  - Custom header: Progress indicator (e.g., "Question 2/8")
  - Scrollable form with large touch targets
  - Next/Submit button floating at bottom
  - Safe area: top: headerHeight + Spacing.xl, bottom: insets.bottom + Spacing.xl + 60 (for floating button)
- **Components:**
  - Large icon-based selection cards (e.g., mood faces)
  - Multi-select symptom chips with icons
  - Slider for pain scale (1-10)
  - Text area for notes
  - Floating primary button with shadow (specs: shadowOffset {0, 2}, opacity 0.10, radius 2)

#### 5. Home (Tab)
- **Purpose:** Overview of health status and upcoming survey
- **Layout:**
  - Transparent header with greeting: "Hello, [Name]"
  - Scrollable content
  - Safe area: top: headerHeight + Spacing.xl, bottom: tabBarHeight + Spacing.xl
- **Components:**
  - Status card: "Next survey due in X days" or "Survey ready"
  - Quick stats: Total surveys completed, recent trends
  - Timeline visualization (simple dots/line graph)
  - CTA button: "Take Survey Now" (if due)

#### 6. Surveys (Tab)
- **Purpose:** View survey history
- **Layout:**
  - Default header with title "Survey History"
  - Scrollable list
  - Safe area: top: headerHeight + Spacing.xl, bottom: tabBarHeight + Spacing.xl
- **Components:**
  - List of survey cards showing date and brief summary
  - Empty state: "No surveys yet" with gentle illustration
  - Tap card to view full survey details (modal)

#### 7. Monthly Survey (FAB Modal)
- **Purpose:** Complete monthly health check
- **Layout:** Same as First Health Survey
- **Flow:** Multi-step form → completion screen with positive reinforcement

#### 8. Suggestions (Tab)
- **Purpose:** Show health recommendations based on patterns
- **Layout:**
  - Default header: "Suggestions"
  - Scrollable list
  - Safe area: top: headerHeight + Spacing.xl, bottom: tabBarHeight + Spacing.xl
- **Components:**
  - Suggestion cards with icon, description, and "Learn More"
  - **Medical Disclaimer** (prominent, at top of screen):
    - Light background card
    - Icon: Info circle
    - Text: "This app does not provide medical advice. Please consult a healthcare professional."
  - Empty state: "Complete more surveys to receive personalized suggestions"

#### 9. Profile & Settings (Tab)
- **Purpose:** Manage account and preferences
- **Layout:**
  - Default header: "Profile"
  - Scrollable settings list
  - Safe area: top: headerHeight + Spacing.xl, bottom: tabBarHeight + Spacing.xl
- **Components:**
  - User avatar (generated preset - medical-themed gentle icons)
  - Display name
  - Settings sections:
    - **Language:** Current language with change option
    - **Notifications:** Toggle for monthly reminders
    - **Account:** Logout, Delete Account (double confirmation)
  - Version number at bottom

## Design System

### Color Palette
**Primary Theme:** Modern health-tech, clean and trustworthy
- **Primary:** Blue (#2563EB) - trust and professionalism
- **Accent:** Orange (#F97316) - energy and action
- **Success:** Green (#10B981) - positive states
- **Background:** Light gray (#F3F4F6)
- **Surface:** White (#FFFFFF)
- **Error:** Red (#EF4444) - for warnings and errors
- **Warning:** Amber (#F59E0B) - for caution
- **Text Primary:** Dark gray (#1F2937)
- **Text Secondary:** Medium gray (#6B7280)
- **Text Muted:** Light gray (#9CA3AF)
- **Border:** Soft gray (#E5E7EB)

### Typography
- **Heading Large:** System bold, 28pt (survey questions)
- **Heading Medium:** System semibold, 22pt (screen titles)
- **Body:** System regular, 16pt (standard text)
- **Body Large:** System regular, 18pt (important instructions)
- **Caption:** System regular, 14pt (disclaimers, metadata)

**RTL Considerations:**
- All text aligns right when Hebrew selected
- Numbers remain LTR even in RTL mode
- Icons flip horizontally where directional (arrows)

### Visual Design
- **Icons:** Feather icons from @expo/vector-icons (medical-appropriate, no emojis)
- **Floating Action Button:** 
  - Circular, 60pt diameter
  - Primary color with white icon
  - Shadow: offset {0, 2}, opacity 0.10, radius 2
  - Icon: Plus or pulse/heartbeat
- **Cards:** 
  - Rounded corners (12pt radius)
  - Subtle border or very light shadow (avoid heavy shadows)
  - 16pt padding
- **Touchable Feedback:** 
  - Opacity change (0.7) on press
  - Scale animation (0.98) for large buttons
- **Survey Options:**
  - Large cards (min 60pt height)
  - Clear selected state (primary color border + light fill)
  - Icons above text for visual clarity

### Accessibility Requirements
- **Minimum touch target:** 44pt × 44pt (especially for elderly users)
- **Text contrast:** WCAG AA minimum (4.5:1 for body text)
- **Font scaling:** Support system font size preferences
- **Screen reader:** All buttons and inputs properly labeled in both languages
- **Reduce motion:** Respect system animation preferences

### Critical Assets
1. **App Icon:** Medical cross or heartbeat pulse in brand colors
2. **User Avatars (3 presets):** Gentle, abstract medical-themed icons (e.g., leaf, lotus, sun) in circular frames
3. **Empty State Illustration:** Simple line art for "no surveys yet"
4. **Symptom Icons (6):** Stomach, head, lungs, heart, fatigue, checkmark for "none"
5. **Mood Icons (3):** Happy, neutral, concerned faces (simple, not emoji)

### Localization Notes
- All UI strings extracted to i18n files (en.json, he.json)
- RTL layout applied automatically when Hebrew selected
- Date formats adapt to locale
- Notification text fully translated
- Medical disclaimers professionally translated (not auto-translated)