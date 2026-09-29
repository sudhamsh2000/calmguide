# The CalmGuide User Interface

## Design philosophy: built for 3 a.m.

The design system's first principle: the user is "standing in a hallway at
3 a.m., holding a phone in one hand, trying to figure out what to do about
their parent right now." From that:

- **Calm, not clinical.** Warm paper-coloured backgrounds, teal and mint
  instead of hospital blue, navy text, rounded corners, generous white space.
  It should feel like a companion, not a medical chart.
- **One main action per screen.** Details are revealed as needed, not shown
  all at once on a dashboard.
- **Safety is always visible.** Emergency numbers are never more than one tap
  away, and are never styled like small print.
- **Accessible by default.** WCAG AA contrast at minimum, large touch targets,
  one-handed use, real dark mode.
- **Healthcare-aware, not healthcare cosplay.** Calm and credible, without
  imitating an electronic health record portal.

## Home screen

- The centrepiece is the **Moment Coach sphere**: an animated, soft-bodied orb
  drawn on canvas. Its outline is built from slow, overlapping sine waves, so
  it is always round but never quite a circle and never repeats. It is hollow
  in the middle, like a lit shell. The team chose this over a rotating
  particle globe on purpose: "a rotating lattice looks like data being
  displayed; a body that deforms looks like something alive and attending."
  It breathes on a slow 4.2-second cycle so it looks like it is **listening,
  not working**. It now also appears on the mobile home screen.
- Below the sphere is a small stack of cards, never more than two at once:
  "How did it go?" (feedback on the last session), "How was today?" (daily
  check-in), "Tonight may need some extra care" (shown only when risk is
  elevated; the app never shows a "tonight looks calm" card), pattern
  insights, and recent conversations.
- The bottom navigation bar and the desktop top navigation were removed to cut
  clutter.

## Moment Coach screen

1. **Start**: a greeting and one large text box: "What's happening right
   now?". There is a microphone for dictation. When the caregiver stops
   speaking, the message is sent automatically, with no extra tap.
2. **Streaming reply**: the answer appears word by word in four visually
   distinct cards:
   - **Right Now**: the most prominent card, with a primary-colour background
     and a raised shadow.
   - **Why This Is Happening**: a neutral card.
   - **What NOT To Do**: a red left border and a red title, so it cannot be
     mistaken for advice.
   - **When To Call For Help**: a muted title. With a linked health record,
     its first line can be "Call Frank's doctor today — he had a fever
     yesterday…".
3. **Read-aloud**: every section has a speaker button, with a natural neural
   voice and an automatic fallback to the device's own voice. With
   "auto-speak replies" on, the reply is read aloud while it is still
   streaming, **sentence by sentence**. Section titles are spoken ("What not to
   do.") so a warning is never heard as advice. Formatting symbols are removed
   so the voice doesn't say "asterisk". This streaming read-aloud is the
   newest UI change and is in progress now. Previously, audio waited for the
   whole first section, or the whole reply, which could mean 20–30 seconds of
   silence.
4. **Feedback**: a thumbs up or down, plus strategy tags ("music", "calm
   approach", "redirection"…) that feed the pattern engine.

## The emergency alert

When Safety Gate v2 decides a message needs 911:

- A **full-screen red alert** covers the app. It is deliberately the one loud
  thing in an otherwise calm product.
- The local emergency number is a **60-pixel call button**: 911 and the
  Alzheimer's Association helpline in the US, or 112 and the ARDSI helpline
  for Hindi.
- It plays a **soft two-pulse tone, not a siren.** The alert goes off in a
  home where someone has dementia, often at night, and a siren could frighten
  the patient and make the situation worse. The tone can be muted, and that
  setting is remembered.
- **It cannot be dismissed by tapping outside it**, so an accidental tap cannot
  clear a 911 prompt. Only the explicit button (or Escape) closes it.
- A HIGH (acute change) decision is urgent but is not a 911 situation, so it
  does not trigger the red alert.

## Care Profile screen

- A two-column layout on desktop. It holds disease stage, behavioural
  patterns, calming strategies, safety concerns, voice settings and language.
- **Connected services → OpenMRS (new)**: Connect → paste the patient ID →
  "Link to Frank?" → Link. After that the caregiver sees a "Synced 3 minutes
  ago" status, a **Test connection** button (shows how many conditions,
  medications, allergies and readings were found), and **Disconnect** with a
  confirm step. It shows "Coming soon" if the server has the feature switched
  off. The same flow is on web and mobile.
- "Delete profile" permanently erases the profile and everything linked to it,
  including the health-record link.

## Protective UI details

- **Session timeout**: the web app signs the caregiver out after 30 minutes
  idle or 12 hours after sign-in, so someone else who picks up the device
  can't open the care profile.
- **Offline banner**: if the connection drops, the caregiver sees a clear
  "you're offline" message in their language instead of a generic server
  error.
- **Three languages throughout**: every button, reply and emergency message is
  in English, Spanish or Hindi.

## Mobile

A React Native app (Expo) with the same features: the sphere on Home, Moment
Coach with streaming and voice, Learn, Check-in, Care Profile with the OpenMRS
link, and the facility portal for staff.
