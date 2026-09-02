import { useTheme } from '@/components/ThemeContext';
import { router, Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.foreground }}>{title}</Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 22 }}>{children}</Text>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingStart: 4 }}>
      <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 22 }}>•</Text>
      <Text style={{ flex: 1, fontSize: 14, color: colors.mutedForeground, lineHeight: 22 }}>
        {children}
      </Text>
    </View>
  );
}

function SubHeading({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontSize: 15,
        fontWeight: '600',
        color: colors.foreground,
        lineHeight: 22,
        marginTop: 4,
      }}
    >
      {children}
    </Text>
  );
}

function Bold({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={{ fontWeight: '600', color: colors.foreground }}>{children}</Text>;
}

function InfoBox({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: 14,
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}

export default function PrivacyScreen() {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
      >
        {/* Header */}
        <View
          style={{
            paddingVertical: 20,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.foreground }}>
            Privacy Policy
          </Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
            Last updated: April 30, 2026
          </Text>
        </View>

        <Section title="1. Privacy at a Glance">
          <Para>
            CalmGuide is designed with privacy as a foundation — not an afterthought. Here is the
            short version:
          </Para>
          <View style={{ gap: 4 }}>
            <Bullet>
              Your patient's <Bold>name is stored only on your device</Bold> — it is sent to the AI
              provider during sessions for personalization but is never saved on our servers
            </Bullet>
            <Bullet>
              Patient profiles are stored on our servers <Bold>linked only to an access code</Bold>,
              not to you
            </Bullet>
            <Bullet>
              We do not require an account, email address, or any personal identifier (for family
              caregivers)
            </Bullet>
            <Bullet>
              All sensitive data is <Bold>encrypted at rest</Bold> using industry-standard
              encryption
            </Bullet>
            <Bullet>
              Your conversations are processed by AI services and are{' '}
              <Bold>not used to train AI models</Bold>
            </Bullet>
            <Bullet>
              Cross-patient learning uses <Bold>anonymized, aggregate data only</Bold> — no personal
              information crosses patient boundaries
            </Bullet>
          </View>
        </Section>

        <Section title="2. What We Collect">
          <SubHeading>Patient Profile (server-side, encrypted)</SubHeading>
          <Para>
            When you complete the profile setup, we store the following on our servers, linked only
            to your access code:
          </Para>
          <View style={{ gap: 4 }}>
            <Bullet>Disease stage</Bullet>
            <Bullet>Behavioral patterns and triggers</Bullet>
            <Bullet>Known calming strategies</Bullet>
            <Bullet>Safety concerns and mobility notes</Bullet>
          </View>
          <Para>
            This information is associated with an 8-character access code and encrypted with
            industry-standard encryption. We have no way to connect it to your identity.
          </Para>
          <InfoBox>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
              A note on what to enter
            </Text>
            <Para>
              We encourage you to use <Bold>clinical and behavioral descriptions</Bold> only — not
              personal identifiers. Profile fields are designed for information like "moderate
              Alzheimer's, sundowning after 5pm" — not names, dates of birth, or addresses.
            </Para>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
              Please avoid entering:
            </Text>
            <View style={{ gap: 4 }}>
              <Bullet>The patient's full name, date of birth, or home address</Bullet>
              <Bullet>Medical record numbers, insurance IDs, or doctor names</Bullet>
              <Bullet>Your own name, email, or contact information</Bullet>
            </View>
            <Para>
              The patient name field in the app is stored <Bold>on your device only</Bold> and is
              never saved to our database. It is sent to the AI provider during each Moment Coach
              session to personalize guidance, but is not retained after the session ends.
            </Para>
          </InfoBox>

          <SubHeading>Conversation History (server-side, encrypted)</SubHeading>
          <Para>
            When you use Moment Coach, your messages and the AI's responses are stored on our
            servers with encryption. This data is used to provide conversation context, display your
            history, detect behavioral patterns, and automatically extract structured incident
            records.
          </Para>

          <SubHeading>Feedback & Behavioral Data (server-side, encrypted)</SubHeading>
          <Para>The following data is also stored with encryption to improve personalization:</Para>
          <View style={{ gap: 4 }}>
            <Bullet>
              Feedback ratings — your thumbs-up/down ratings and strategy tags on AI responses
            </Bullet>
            <Bullet>Daily check-in logs — the daily behavioral state you report</Bullet>
            <Bullet>
              Incident records — behavioral incidents you log or that are auto-extracted from
              conversations
            </Bullet>
            <Bullet>
              Behavioral dossier — a derived summary of what works and what doesn't for this patient
            </Bullet>
            <Bullet>
              Care change events — medication or care changes you log, with observation windows
            </Bullet>
            <Bullet>
              Profile insights — computed behavioral patterns, cycle detection, and risk scores
            </Bullet>
          </View>

          <SubHeading>Technical Data</SubHeading>
          <Para>
            Standard server logs may include IP addresses, request timestamps, and HTTP status codes
            for operational and security purposes. This data is not used to identify or profile
            users.
          </Para>

          <SubHeading>Facility Staff Data (B2B only)</SubHeading>
          <Para>
            For professional care facilities, staff member information (name, email, role, login
            timestamps) is stored and managed by the facility administrator. All facility actions
            are recorded in an audit log for compliance purposes. Staff authentication uses securely
            hashed PINs or passwords with automatic lockout after repeated failed attempts.
          </Para>
        </Section>

        <Section title="3. What We Don't Collect">
          <View style={{ gap: 4 }}>
            <Bullet>Your name (for family caregivers) — no account system exists</Bullet>
            <Bullet>The patient's name on our servers — stored on your device only</Bullet>
            <Bullet>Email address (for family caregivers) — no account system exists</Bullet>
            <Bullet>
              Payment or billing information — the service is free for family caregivers
            </Bullet>
            <Bullet>Location data</Bullet>
            <Bullet>Device identifiers or advertising IDs</Bullet>
            <Bullet>Cross-site tracking data</Bullet>
          </View>
        </Section>

        <Section title="4. How We Use Your Information">
          <Para>We use the information we collect solely to:</Para>
          <View style={{ gap: 4 }}>
            <Bullet>Retrieve your patient profile when you enter your access code</Bullet>
            <Bullet>
              Inject the patient profile, past incidents, and behavioral insights into AI prompts to
              generate personalized guidance
            </Bullet>
            <Bullet>Display your conversation history and behavioral patterns</Bullet>
            <Bullet>Detect episode cycles and generate predictive care-level alerts</Bullet>
            <Bullet>Compute anonymized cross-patient strategy effectiveness</Bullet>
            <Bullet>Operate, maintain, and improve the security of the service</Bullet>
          </View>
          <Para>
            We do not sell, rent, or share your information with third parties for advertising,
            marketing, or any commercial purpose.
          </Para>
        </Section>

        <Section title="5. AI Processing">
          <Para>
            CalmGuide uses third-party AI services to generate guidance. The active provider is
            configurable and currently includes:
          </Para>
          <View style={{ gap: 4 }}>
            <Bullet>
              <Bold>OpenAI</Bold> — for generating chat responses, embedding queries to retrieve
              relevant caregiving guidance, and extracting structured incident data
            </Bullet>
            <Bullet>
              <Bold>Anthropic (Claude)</Bold> — available as an alternative provider for all AI
              features
            </Bullet>
          </View>

          <SubHeading>What is sent to these services</SubHeading>
          <View style={{ gap: 4 }}>
            <Bullet>Your description of the current situation or your practice response</Bullet>
            <Bullet>
              The patient's clinical profile (disease stage, behavioral patterns, calming
              strategies, safety concerns)
            </Bullet>
            <Bullet>
              The patient's name (from your device storage) — used to personalize the AI's response
              but never stored on our servers
            </Bullet>
            <Bullet>Relevant past incidents and behavioral dossier data</Bullet>
            <Bullet>Relevant caregiving guidance retrieved from our knowledge base</Bullet>
            <Bullet>Anonymized cross-patient strategy data</Bullet>
            <Bullet>Conversation history within the current session</Bullet>
            <Bullet>A system prompt that defines how the AI should respond</Bullet>
          </View>

          <SubHeading>Knowledge base</SubHeading>
          <Para>
            CalmGuide maintains a knowledge base of publicly available caregiving content from the
            Alzheimer's Association, Mayo Clinic, HelpGuide, Family Caregiver Alliance, and the CDC.
            Your query is sent to OpenAI's embedding service to find relevant guidance. For
            non-English queries, the message is first translated to English for retrieval. This
            contains only your query text — not your patient profile.
          </Para>

          <SubHeading>AI provider privacy policies</SubHeading>
          <Para>
            Per their API terms, data submitted via their APIs is not used to train their models.
            Providers include OpenAI (openai.com/policies/privacy-policy) and Anthropic
            (anthropic.com/privacy).
          </Para>
        </Section>

        <Section title="6. Cross-Patient Learning">
          <Para>
            CalmGuide uses anonymized, aggregate data from all caregivers to improve guidance for
            everyone:
          </Para>
          <View style={{ gap: 4 }}>
            <Bullet>
              When you rate a response as helpful and select strategy tags, those tags are counted
              at the cohort level
            </Bullet>
            <Bullet>Patients are grouped by disease stage and peak episode time</Bullet>
            <Bullet>
              Only 12 predefined strategy tags cross patient boundaries — no free-text or custom
              tags
            </Bullet>
            <Bullet>
              Cross-patient data is only surfaced when a cohort contains at least 5 patients
              (k-anonymity)
            </Bullet>
            <Bullet>
              No patient names, profile IDs, or individual data points appear in the cross-patient
              data
            </Bullet>
          </View>
        </Section>

        <Section title="7. Device Storage">
          <SubHeading>What is stored on your device</SubHeading>
          <View style={{ gap: 4 }}>
            <Bullet>
              <Bold>Patient name</Bold> — stored locally so it can be displayed in the app and sent
              to the AI provider for personalization. Never saved to our database.
            </Bullet>
            <Bullet>
              <Bold>Access code</Bold> — stored so you don't need to re-enter it on each visit.
            </Bullet>
            <Bullet>
              <Bold>Language preference</Bold> — your selected language for the interface.
            </Bullet>
            <Bullet>
              <Bold>Medical disclaimer acknowledgment</Bold> — whether you have acknowledged the
              disclaimer.
            </Bullet>
          </View>
          <Para>
            For facility staff, device storage also holds an authentication token (auto-expires),
            facility code, and staff profile information.
          </Para>
          <Para>
            You can clear this data at any time by signing out from the Profile tab, or by
            uninstalling the app.
          </Para>
          <Para>
            We do not use analytics SDKs, advertising frameworks, or third-party tracking in this
            mobile app.
          </Para>
        </Section>

        <Section title="8. Data Retention & Deletion">
          <Para>
            Patient profiles, conversation history, incident records, and derived insights are
            retained indefinitely while associated with an active access code. Since we cannot
            identify you, we cannot proactively delete your data — but you can request deletion by
            providing your access code.
          </Para>
          <Para>
            Server logs are retained for up to 30 days for operational purposes. Facility audit logs
            are retained for compliance purposes as configured by the facility administrator.
          </Para>
        </Section>

        <Section title="9. Data Security">
          <Para>We take reasonable steps to protect your information:</Para>
          <View style={{ gap: 4 }}>
            <Bullet>All data is encrypted in transit (HTTPS/TLS)</Bullet>
            <Bullet>
              All sensitive data is encrypted at rest using industry-standard encryption — including
              conversations, profile data, feedback, incidents, daily logs, and behavioral insights
            </Bullet>
            <Bullet>
              Access codes are securely hashed — we store only the hash, never the plaintext code
            </Bullet>
            <Bullet>Facility staff PINs and passwords are securely hashed</Bullet>
            <Bullet>
              Auto-extracted incident narratives are scrubbed of third-party personally identifiable
              information before storage
            </Bullet>
            <Bullet>
              Access codes are the sole credential linking a device to a profile — there is no
              account to compromise
            </Bullet>
          </View>
          <Para>
            The design of CalmGuide — no names on our servers, no emails, no accounts, encryption at
            rest — limits the sensitivity of any data breach.
          </Para>
        </Section>

        <Section title="10. Your Rights">
          <Para>You have the right to:</Para>
          <View style={{ gap: 4 }}>
            <Bullet>
              <Bold>Access</Bold> — request the profile data associated with your access code
            </Bullet>
            <Bullet>
              <Bold>Correction</Bold> — update your patient profile at any time via the app
            </Bullet>
            <Bullet>
              <Bold>Deletion</Bold> — request deletion of the profile and all associated data
              (conversations, incidents, insights, feedback) linked to your access code
            </Bullet>
          </View>
          <Para>
            Because we have no way to verify your identity, deletion requests require you to provide
            your access code. Contact us through our official channels with your request.
          </Para>
        </Section>

        <Section title="11. Children's Privacy">
          <Para>
            CalmGuide is intended for adult caregivers (18+). We do not knowingly collect
            information from anyone under 18. If you believe a minor has used the service, contact
            us and we will delete the associated data.
          </Para>
        </Section>

        <Section title="12. Changes to This Policy">
          <Para>
            We may update this policy from time to time. The "Last updated" date at the top of this
            page reflects the most recent revision. Continued use of the service after changes
            constitutes acceptance.
          </Para>
        </Section>

        <View style={{ paddingVertical: 20, gap: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.foreground }}>
            13. Contact Us
          </Text>
          <Para>
            For privacy questions, data access or deletion requests, or any concerns about how we
            handle your information, please reach out through our official contact channels.
          </Para>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 22 }}>
            See also our{' '}
            <Text style={{ color: colors.primary }} onPress={() => router.push('/terms')}>
              Terms of Service
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
