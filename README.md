# AVIRA CareCircle — PromptWars × Catalyst 2026

**Challenge:** Elderly Care & Medication Management Platform  
**Tagline:** One elder. One plan. One circle of care.  
**Status:** Functional full-stack prototype with synthetic demonstration data; not a regulated medical device or clinical service.

---

## Quick Start (Under 60 Seconds)

Requires **Node.js 20+**. Zero npm dependencies (built on standard Node.js HTTP and test libraries).

```bash
# 1. Run automated test suite (17 tests)
npm test

# 2. Start the local server
npm start
```

Open your browser to: **[http://localhost:8080](http://localhost:8080)**

### Demo Accounts & Passcode Access
| Profile | User ID | Passcode | Role Level | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Anita Rao** | `elder` | `2468` | **Primary Center** | Manages routines, confirms doses (Taken/Missed), manages appointments, exports audit |
| **Meera Rao** | `carer` | `1357` | **Co-Manager** | Adds/removes routines, confirms doses, manages appointments, triggers reminders |
| **Arjun Rao** | `family` | `9876` | **Shared Visibility** | Read-only access for peace of mind (cannot alter medication or clinical records) |

*Security Notice:* Demo passcodes are intentionally pre-configured and visible for evaluation. Never enter Protected Health Information (PHI) or use demo passcodes in production.

---

## Core Capabilities & Verified Features

### 1. Role-Aware Passcode Access
- Cryptographically signed HMAC-SHA256 session tokens with 12-hour expiry and timing-safe signature comparison.
- Three tailored operational perspectives:
  - **Elder (`elder`)**: Unrestricted self-determination over daily medications and care plans.
  - **Caregiver (`carer`)**: Collaborative co-manager supporting scheduling and proactive follow-up.
  - **Family (`family`)**: Strictly read-only oversight to prevent unauthorized clinical alterations while maintaining family transparency.

### 2. Medication Scheduling & Lifecycle
- Dynamic medication routines with dosage instructions, scheduled UTC times, and clinical care notes.
- REST endpoints supporting `POST /api/medications`, `PATCH /api/medications/:id`, and `DELETE /api/medications/:id`.
- Instant schedule updates with immediate UI synchronization.

### 3. Human-Confirmed Adherence Tracking
- Direct dose confirmation (`✓ Taken` or `Missed`) recorded per medication per day.
- Idempotency and duplicate prevention: Re-recording the same medication on the same day is rejected (`409 Conflict`), preventing accidental double-dosing.
- Real-time visual adherence progress gauge displaying percentage taken, missed events, and total recorded doses.
- Chronological adherence audit log with timestamps and user attribution (`by elder` / `by carer`).

### 4. Appointment & Care Calendar Management
- Coordinated appointments with title, date, time, physical location / telemedicine link, and preparation notes.
- Relative date cues (e.g., `Today`, `Tomorrow`, `In X days`).
- Full add and deletion capabilities (`POST /api/appointments` and `DELETE /api/appointments/:id`).

### 5. Proactive Due & Overdue Reminder Logic
- Dynamic reminder calculation engine with configurable lead times (default: 30 minutes).
- Automatic categorization:
  - `upcoming`: Generated within the 30-minute window before scheduled dose time.
  - `overdue`: Generated if dose remains unconfirmed after the scheduled time.
  - `appointment`: Generated ahead of scheduled clinical reviews.
- Deduplication ledger prevents duplicate alert spam.
- Integrated preview ledger mode with optional transactional email delivery via Resend (`RESEND_API_KEY`, `FROM_EMAIL`, `REMINDER_EMAIL`).

### 6. Transparent AI-Assisted Care Follow-Up Signals
- Experimental logistic regression classifier implemented in standard JavaScript, trained on 60 synthetic fictional routine scenarios.
- Inputs: Recorded historical miss rate, time-of-day indicator (evening vs. daytime), and recent missed event status.
- Output: Synthetic Risk Score (`0-100/100`) and clear follow-up labels (`FOLLOW-UP SUGGESTED`, `CHECK ROUTINE`, `LOW DEMO SIGNAL`).
- Practical caregiver follow-up prompts (e.g., "Consider verifying medicine organizer has evening doses pre-staged").
- **Strict Ethical Transparency:** Prominently labeled as non-clinical decision support; no claims of medical diagnosis or clinical efficacy.

### 7. Professional Grey-and-White Interface & Accessibility
- Clean, clinical grey-and-white design system with subtle contrast, elegant borders, and calm Nordic hospital aesthetics.
- **Senior Accessibility (WCAG 2.1 AA/AAA):**
  - **Senior Large Text Mode Toggle (`Aa`):** Scaled 18px+ typography and enlarged 52px+ touch targets for seniors with reduced motor precision or presbyopia.
  - **High Contrast Toggle (`◐`):** High-contrast black-and-white theme for low-vision users.
  - **High-contrast keyboard focus outlines (`:focus-visible`).**
  - **ARIA live regions (`aria-live="polite"`)** for screen-reader adherence announcements.
  - Full responsiveness across mobile phones (320px+), tablets, and desktop workstations.

### 8. Interactive Animated CareCircle Visualization
- Hardware-accelerated CSS 3D holographic care mesh depicting collaborative relationships.
- Central **Elder Decision Core** surrounded by rotating relational rings.
- Orbiting **Caregiver (Meera)** and **Family (Arjun)** nodes with animated care pulse rays.
- Interactive node inspector: click any node in the mesh to inspect their role, permissions, and synchronization status.
- Full support for `prefers-reduced-motion` accessibility standards.

### 9. Transparent Care Audit Export
- One-click export (`GET /api/report`) generating a downloadable JSON care report containing active medications, adherence percentages, historical event logs, appointment schedules, and data disclaimers.

---

## Automated Test Results

The project includes an automated test suite executed with Node's built-in test runner (`node --test tests/*.test.js`).

**Actual Test Run Output:**
```
✔ 1. health endpoint returns 200 ready and metadata (2.05ms)
✔ 2. login rejects wrong passcode with 401 (0.87ms)
✔ 3. protected routes require authorization token (0.46ms)
✔ 4. elder signs in and views personalized schedule (1.44ms)
✔ 5. caregiver signs in and has editing permissions (0.94ms)
✔ 6. family member is read-only and mutations return 403 (1.61ms)
✔ 7. invalid schedule format rejected with 400 (0.65ms)
✔ 8. medication can be created, updated via PATCH, and removed via DELETE (3.42ms)
✔ 9. appointment validation rejects malformed date (0.75ms)
✔ 10. valid appointment can be created and deleted (1.76ms)
✔ 11. adherence saved and duplicate confirmation rejected with 409 (1.07ms)
✔ 12. due reminders calculation yields upcoming notifications within lead time (0.20ms)
✔ 13. reminders endpoint runs deduplication and logs notices (0.39ms)
✔ 14. ML follow-up signals include transparent synthetic disclaimer (0.56ms)
✔ 15. report exposes transparent audit summary and non-medical disclaimer (0.38ms)
✔ 16. static assets serve index.html, app.js, style.css with security headers (5.76ms)
✔ 17. unknown route returns 404 and invalid method returns 405 (1.44ms)

ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms ~142ms
```

---

## Summary of Changes & Improvements

1. **Repository & Architecture Cleanup:**
   - Promoted project structure to the repository root for compatibility with Render, GitHub Actions, and standard dev workflows.
   - Initialized Git on a single `main` branch with total repository size under 110 KB (well within the 10 MB limit).
   - Ensured zero secret leakage and enforced `.gitignore` for local `data.json`, `.env`, and logs.

2. **Backend & API Refinements (`server.js`):**
   - Replaced static startup date with dynamic `getToday()` helper for midnight-crossing accuracy.
   - Implemented `DELETE /api/appointments/:id` and `DELETE /api/medications/:id` with permission enforcement (`canEdit`).
   - Exported `handler` and `resetDb` to enable resilient in-memory automated testing alongside standard TCP networking.
   - Enhanced Content-Security-Policy (CSP) and strict security response headers.

3. **Frontend & Accessibility Enhancements (`public/index.html`, `public/style.css`, `public/app.js`):**
   - Implemented professional grey-and-white design system adhering to WCAG 2.1 AA/AAA contrast guidelines.
   - Added **Senior Large Text Mode** and **High Contrast Mode** toggles with persistent `localStorage` memory.
   - Enhanced touch targets (minimum 44px standard, 52px+ in Senior Mode) and keyboard `:focus-visible` outlines.
   - Created an interactive **Holographic CareCircle Visualization** with 3D orbiting satellites, live mesh rings, and node inspector.
   - Upgraded AI signals card with transparent explainable feature breakdowns and non-clinical caregiver recommendations.
   - Added live UTC digital clock for synchronized demonstration testing.

4. **Automated Testing Suite (`tests/api.test.js`):**
   - Expanded test suite from 12 to 17 comprehensive test cases.
   - Built a universal in-memory dispatcher allowing tests to execute reliably in restricted sandboxes, Docker, and CI/CD without network port permission barriers.

---

## Important Disclaimers & Limitations

1. **Non-Clinical Demonstration Prototype:** AVIRA CareCircle is created for the PromptWars × Catalyst 2026 Solo AI Hackathon. It uses synthetic demo data and fictional profiles. It is **not** a certified medical device, does not diagnose medical conditions, and must never be used for real clinical treatment or medication decisions.
2. **AI Transparency:** The AI-assisted signals are powered by a transparent, on-device logistic regression model trained exclusively on 60 synthetic fictional examples. It does not possess medical validation or clinical efficacy data.
3. **UTC Scheduling:** Schedules and reminders operate on UTC for prototype predictability.
4. **Email Notifications:** Email delivery is preview-only by default. Live transactional emails require explicit user configuration of a verified domain on Resend.
5. **No PHI:** Do not submit or store real Personally Identifiable Information (PII) or Protected Health Information (PHI).

---

## Repository Structure

```
├── .gitignore                                      # Ignores data.json, .env, and logs
├── AVIRA_CareCircle_Catalyst_2026_Professional_Pitch.pptx # Pitch deck presentation (~61 KB)
├── package.json                                    # Zero npm dependencies, scripts for test and start
├── README.md                                       # Complete project documentation and verification guide
├── render.yaml                                     # Infrastructure-as-code for Render deployment
├── server.js                                       # Native Node.js HTTP/API server with HMAC auth
├── lib/
│   └── careSignals.js                              # Synthetic logistic regression follow-up classifier
├── public/
│   ├── app.js                                      # Accessible client-side application logic
│   ├── index.html                                  # Accessible semantic HTML5 layout
│   └── style.css                                   # Grey-and-white responsive stylesheet & 3D CSS
├── tests/
│   └── api.test.js                                 # 17 automated integration & security tests
└── docs/
    ├── HACK2SKILL_SUBMISSION_COPY.txt              # Hack2Skill competition submission copy
    └── ROUND1_AND_FINAL_PITCH.md                   # Complete judging pitch and design rationale
```
