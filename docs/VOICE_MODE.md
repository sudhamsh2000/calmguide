# Voice-only mode (ElevenLabs)

A hands-free conversation for moments when typing is too slow. ElevenLabs runs
the call (speech-to-text, turn-taking, text-to-speech). CalmGuide is the
agent's **Custom LLM**, so the text of every spoken turn reaches the CalmGuide
backend first and goes through Safety Gate v2 before any model is called.

```
caregiver speaks ─► ElevenLabs STT ─► POST /api/voice/llm/chat/completions
                                         │
                                         ├─ Safety Gate v2 (same as /coach/chat)
                                         │    emergency/high ─► fixed escalation copy, no model call
                                         │    otherwise      ─► coach prompt + voice rules ─► model
                                         │                       ─► response guard (before sending)
                                         ▼
caregiver hears  ◄─ ElevenLabs TTS ◄─ plain spoken text (markdown stripped)
```

## How it differs from typed chat

- **Emergency copy is identical.** Same text as typed chat, with only the
  formatting characters removed (`to_spoken_text`), so the wording stays what
  was reviewed.
- **Replies are checked before they're spoken.** Typed chat streams and swaps a
  bad answer afterwards; a spoken answer can't be taken back, so voice turns
  are generated in full, passed through the response guard, then sent.
- **Short answers.** The coach prompt's safety principles and patient profile
  apply, but its four-section format is replaced with two to four spoken
  sentences.
- **Lighter context.** RAG, dossier, past incidents and OpenMRS are skipped on
  voice turns to keep time-to-first-word low.
- **The agent's dashboard prompt is ignored.** CalmGuide always supplies the
  system prompt, so editing the agent in ElevenLabs can't weaken it.

## ElevenLabs agent setup

1. Create an agent. Set its **first message** (e.g. "I'm here. Tell me what's
   happening.") and language(s).
2. **LLM → Custom LLM**, Chat Completions format:
   - Server URL: `https://<your-api-host>/api/voice/llm` (ElevenLabs appends
     `/chat/completions`)
   - Model ID: any value, e.g. `calmguide`
   - API key: a new secret with the same value as `VOICE_LLM_SECRET`
3. **Security:** enable *custom LLM extra body* so the client can pass the
   voice token. For a private agent, enable authentication and set
   `ELEVENLABS_API_KEY` on the backend.
4. Backend env: `VOICE_ENABLED=true`, `VOICE_LLM_SECRET`, `ELEVENLABS_AGENT_ID`
   (and optionally `ELEVENLABS_API_KEY`).

## Web app

- **Entry:** "Talk instead" on the Moment Coach screen (a card before the first
  message, a pill in the header after). Facility mode carries the resident
  context through.
- **Screen:** `/[locale]/voice` — `frontend/src/features/voice/VoiceCallView.tsx`
  (presentational) driven by `useVoiceCall.ts` (`@elevenlabs/react`).
- **During a call** a large *Call {local emergency number}* button is pinned
  above the controls; outside a call the app-wide emergency bar covers it.
- **Emergency alert:** after each agent reply the screen asks
  `GET /api/voice/sessions/{id}/safety` (authorized by the call's voice token).
  A new emergency turn raises the same full-screen alert typed chat uses; a
  dismissed alert only comes back for a *new* emergency turn. The safety event
  is written before the reply is returned, so the check never races it.
- The microphone is requested before connecting, so a refusal gets its own
  message. Leaving the screen hangs up.

### Client flow

```ts
// 1. Ask CalmGuide for a per-call token (same identity as /coach/chat).
const s = await startVoiceSession(accessCode, patientName, profileId);

// 2. Start the ElevenLabs conversation, passing the token through.
conversation.startSession({
  ...(s.signed_url ? { signedUrl: s.signed_url } : { agentId: s.agent_id }),
  customLlmExtraBody: { voice_token: s.voice_token },
});
```

The token is short-lived (`VOICE_TOKEN_TTL_SECONDS`), scoped to the voice
endpoints only (it is rejected as a staff token and vice versa), and carries
the profile, session id, locale and the transient patient name.

## Not done yet

- **Mobile app** — needs `@elevenlabs/react-native` plus LiveKit's native
  WebRTC modules, so a new APK build rather than an EAS update.
- **No live test against ElevenLabs yet.** The request/response format follows
  their OpenAI-compatible Custom LLM contract and is covered by
  `backend/tests/test_voice.py` and `frontend/src/features/voice/*.test.tsx`.
- Spanish and Hindi voice strings in `coach.json` are pending professional
  review, like the rest of that file (see `locales/REVIEW_STATUS.md`).
