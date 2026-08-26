# CalmGuide Incident Response Runbook

## Purpose

What to do if a user reports harm, distress, or adverse outcomes after interacting with CalmGuide's AI features.

## Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| **P0 — Critical** | User reports self-harm, harm to patient, or death connected to AI interaction | Immediate (within 1 hour) |
| **P1 — High** | User reports dangerous advice given by AI (medication, restraint, contradicts 911) | Within 4 hours |
| **P2 — Medium** | User reports distressing or inappropriate AI response | Within 24 hours |
| **P3 — Low** | User reports inaccurate but non-harmful information | Within 72 hours |

## P0 Response Procedure (User Harm / Death)

### Immediate (0-1 hour)
1. **Do not delete anything.** Preserve all logs, conversation records, and system state.
2. Pull the full conversation from the database using the session ID.
3. Check if the deterministic safety gate fired. If not, determine why (keyword gap, new pattern).
4. Notify the team lead and all team members immediately.
5. If the user is still in contact, provide 911 / 988 / Alzheimer's helpline numbers directly.

### Short-term (1-24 hours)
6. Export and archive the full conversation, system prompt, and model response.
7. Disable the specific AI feature if the failure mode is reproducible.
8. Draft a factual incident summary: what happened, what the AI said, what the user reported.
9. Contact a healthcare lawyer for guidance on disclosure and liability.
10. Do NOT post publicly or acknowledge the incident on social media without legal counsel.

### Follow-up (24-72 hours)
11. Root cause analysis: was it a safety gate gap, prompt failure, or model hallucination?
12. Implement a fix (new keyword pattern, prompt revision, or feature disable).
13. Test the fix against the original input and 50+ similar inputs.
14. Document the incident in a private incident log (not in the public repo).

## P1 Response Procedure (Dangerous Advice)

1. Reproduce the issue with the exact input.
2. Check if the system prompt rules (Rule 1-3) were violated.
3. If reproducible, add the pattern to safety gate keywords or adjust the prompt.
4. Deploy the fix and verify.
5. If the user provided contact info, follow up with a correction.

## P2-P3 Response Procedure

1. Log the report with session ID and user description.
2. Reproduce and classify (model error, prompt gap, or expected behavior).
3. Fix in next sprint if actionable.

## Key Contacts

| Role | Contact | When to reach |
|------|---------|---------------|
| Team Lead | Sharan Karthikeyan | All P0/P1 incidents |
| All team members | Team group chat | P0 incidents |
| Healthcare Lawyer | TBD (retain before paid launch) | P0 incidents, any legal questions |
| Alzheimer's Association | 1-800-272-3900 | Refer users who need human support |
| 988 Suicide & Crisis Lifeline | 988 | Refer users in crisis |

## Safety Gate Audit Schedule

- After every P0/P1 incident: review and expand keyword patterns
- Monthly: run full test suite against safety gate (target: 100+ test inputs)
- Quarterly: external review of system prompt safety rules

## User Reporting Channels

Users must have a way to report concerns. Before any user onboarding, set up:

1. **In-app "Report a concern" link** — visible on every AI response (in the feedback widget or via the emergency bar). Routes to the intake email.
2. **Intake email: safety@calmguide.app** — Monitored daily. All reports logged and triaged within 24 hours.
3. **App store reviews** — Monitor weekly for harm-related keywords ("dangerous", "hurt", "wrong advice", "unsafe").
4. **Social media** — Set up alerts for mentions of CalmGuide + harm-related terms.

All incoming reports should be triaged to the severity levels above within 24 hours.

## Evidence Preservation

For any reported incident:
- **Never delete** conversation records, logs, or model outputs
- Export the full session (user messages + AI responses + timestamps)
- Screenshot any user-reported context (email, app store review, social media post)
- Store incident records in a private, access-controlled location
- Retention: minimum 7 years for healthcare-adjacent incidents
