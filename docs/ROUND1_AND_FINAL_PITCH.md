# AVIRA CareCircle — Judging pitch

**Tagline:** One elder. One plan. One circle of care.

**Problem:** Medication management is fragmented between elders, family members and caregivers. Missed doses, duplicate reminders and disconnected appointments create cognitive burden and uncertainty. Existing apps often focus on reminders without transparent collaborative follow-through.

**Solution:** AVIRA CareCircle is an elder-centered shared care workspace where the elder and caregiver maintain routines, family can see the same plan, and dose confirmations create a visible adherence timeline. Due/overdue appointments produce notification previews and, when configured, opt-in transactional email.

**Differentiation:** 1) Elder-centric role view; 2) visible care circle; 3) human-confirmed adherence, not inferred ingestion; 4) reminder deduplication; 5) clear notification-delivery state, not claims of unverified email delivery; 6) simple exportable care log.

**End users:** Elderly people who choose to participate, authorized family members, home caregivers. A production version would require explicit elder consent, accessible onboarding, privacy, caregiver verification and clinical review.

**Implementation:** Node.js API, responsive browser front end, synthetic demo data, 3D CSS animation, simple role authorization, reminder scheduler, optional Resend API. Experimental logistic regression trained on 60 synthetic scenarios provides labeled follow-up cues for demonstration only; no LLM integrated and no clinical efficacy claims.

**Impact metrics to evaluate in a real pilot:** missed-dose follow-up time, successful reminder delivery percentage, caregiver task completion time, number of unresolved care-plan conflicts, elder usability outcomes. **None are measured in this prototype.**

**Demonstrated result:** APIs for authentication, role enforcement, medication scheduling, adherence tracking, appointments, reminder deduplication, and reporting are exercised by automated tests (17 of 17 tests passed). Adherence chart and care mesh respond dynamically to recorded demo interactions. No real-world medical results are claimed.

**What remains before competition submission:** Publish repository, verify deployed web demo, capture video/screenshots if requested, paste GitHub and deployment URLs into Hack2Skill, and confirm submission received.
