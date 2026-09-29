# CalmGuide — Deferred Features & Future Roadmap

Features that were designed but intentionally deferred from the current implementation. Each includes the rationale for deferral and conditions for when to build it.

---

## Push Notifications (Care Pattern Alerts)

**What:** Condition-triggered push notifications when care patterns suggest a difficult period ahead. "We're noticing a pattern — music and calm approach have helped before."

**Why deferred:**
- Requires Expo notification infrastructure (`expo-notifications`, push tokens, FCM/APNs server-side setup)
- Significant engineering work for limited initial reach
- Research (BESI system, JMIR Aging 2021) shows in-app alerts are sufficient when caregivers regularly open the app
- Risk of alarm fatigue for stressed caregivers if false positive rate is high

**Current alternative:** In-app "What we're noticing" card on the home screen. Condition-triggered (only when care patterns suggest attention needed), never scheduled.

**When to build:**
- Care pattern detection is validated (low false positive rate across 50+ profiles)
- Caregivers actively request it
- Implementation: opt-in only, max 1/day, caregiver sets quiet window, condition-triggered not scheduled

---

## SMS Alerts

**What:** SMS-based care pattern alerts for caregivers without smartphones.

**Why deferred:** No advantage over push for app-native users. CalmGuide requires a smartphone (web or mobile app) for crisis guidance, so SMS adds no reach.

**When to build:** If a simplified SMS-only tier is explored for basic phones.

---

## Day-of-Week Pattern Detection

**What:** Detect if episodes cluster on specific days (e.g., worse on weekends).

**Why deferred:** No peer-reviewed evidence found for reliable day-of-week clustering in dementia behavioral episodes. The weekend signal is clinical speculation, not statistically validated.

**When to build:** If 12+ months of daily check-in data across 100+ profiles reveals statistically significant day-of-week patterns.

---

## Strategy Effectiveness by Time-of-Day

**What:** "Music works 80% at night but only 30% in the morning."

**Why deferred:** Insufficient evidence that non-pharmacological interventions have time-of-day-dependent effectiveness. Studies test weekly, not by time slot.

**When to build:** If daily check-in data (with time slots + strategy tags) reveals statistically significant time-context correlations across 50+ profiles.

---

## Seasonal Pattern Detection

**What:** Detect if episodes are worse in winter (shorter daylight — documented for sundowning).

**Why deferred:** Requires 12+ months of continuous data per profile. No profiles have that yet.

**When to build:** When the oldest profiles have 12+ months of daily check-in data.

---

## Key Rotation for AES-256-GCM Encryption

**What:** Rotate the `CONVERSATION_ENCRYPTION_KEY` without downtime. Requires a re-encryption migration job.

**Why deferred:** The current single-key approach is secure. Key rotation adds complexity and is only needed for compliance (HIPAA, SOC2) or if the key is compromised.

**When to build:** Before pursuing clinical partnerships or HIPAA certification.

---

## Envelope Encryption (AWS KMS / Cloud HSM)

**What:** Each profile gets a unique data encryption key (DEK), itself encrypted by a master key (KEK) from AWS KMS or similar.

**Why deferred:** Overkill for the current deployment (Railway single-container). Adds cloud vendor dependency and latency.

**When to build:** When HIPAA compliance is required for clinical partnerships.

---

## Care Team Sharing / PDF Export

**What:** Caregiver can export a session summary or behavioral pattern report as PDF/link to share with a doctor or family member.

**Why deferred:** Requires careful thinking about consent, data governance, and what information is safe to share outside the app.

**When to build:** Phase 4 — after cross-patient learning is validated and the pattern reports are clinically meaningful.

---

## Feedback-Driven Prompt Tuning

**What:** Automatically adjust the crisis system prompt based on aggregate feedback — e.g., if "what NOT to do" sections consistently get thumbs-down, reduce their weight.

**Why deferred:** Requires large-scale feedback data and careful A/B testing to avoid degrading response quality.

**When to build:** When 500+ feedback entries exist and a prompt evaluation framework is in place.

---

## In-Conversation Per-Response Feedback Widgets

**What:** When revisiting a past crisis session, each assistant response shows an expandable feedback widget (thumbs + tags).

**Why deferred:** The messages API doesn't return conversation IDs needed to map responses to feedback. The home screen feedback card (primary path) captures the majority of feedback.

**When to build:** When the messages API is extended to return `conversation_id` per message. Low priority since the home card captures most feedback.

---

## Medication Change Input

**What:** Caregiver explicitly logs when medications change, triggering an immediate pattern reset.

**Why deferred:** The exponential decay weighting in the pattern detector (recent data weighted 3x vs older data) handles medication changes automatically within 2-3 weeks. An explicit input adds UX complexity for marginal benefit.

**When to build:** If caregivers report frustration with the 2-3 week adaptation period.

---

## Full Offline Support (Request Queueing, Background Sync, Read Caching)

**What:** P2-12 shipped connectivity *detection* only — an offline banner, localized "you're offline" error copy (vs. a generic server error), and a passive server-side LLM-availability signal on `/health`. It intentionally stops short of:
- **Request queueing:** a caregiver's message typed while offline is not saved and auto-sent on reconnect. They see the offline banner/error and must retry manually once back online (mobile does preserve the typed draft in the input field so nothing is lost; the web check-in/coach screens do not clear it either, but neither queues a resend).
- **Background sync:** no service worker (web) or background task (mobile) retries failed requests when connectivity returns.
- **Offline read caching:** past conversations, insights, and care patterns aren't cached for offline viewing — those screens still require a live connection.

**Why deferred:** Request queueing and background sync for a crisis-guidance app raise real safety questions that need deliberate design, not a quick add: a queued message could be sent hours later with stale context, and a caregiver who thinks a life-threat message was "sent" while offline needs to know the safety gate (regex + classifier) is server-side and never ran on it — see `SAFETY_ARCHITECTURE.md`. Building queueing without addressing that is worse than not having it.

**When to build:** After the offline-safety-gate gap above is explicitly resolved (e.g., a client-side keyword tripwire that always shows the crisis resources even offline) — queueing safety-relevant messages before that would be actively misleading.

---

## Cross-Patient Learning Fed Into RAG

**What:** The most effective strategies from cross-patient aggregation are ingested into the RAG knowledge base, so they appear in semantic search results alongside Alzheimer's Association guidance.

**Why deferred:** Mixing user-generated strategy data with authoritative medical guidance requires careful quality gates.

**When to build:** When cross-patient data reaches statistical significance (100+ profiles, 1000+ feedback entries).

---

## Health Record Link on Mobile, and Fitbit

**What:** The OpenMRS "Health record" link on the Care Profile exists on web only. The mobile (Expo) Care Profile has no equivalent yet, and Fitbit is still a "Coming soon" row.

**Why deferred:** Built for the October demos against a single test OpenMRS instance; mobile parity and a second source weren't needed to show the flow.

**When to build:** After clinicians have reviewed coach replies that use the clinical summary. Fitbit plugs in as another `clinical_links.source` value and another branch in the coach's context gather.

