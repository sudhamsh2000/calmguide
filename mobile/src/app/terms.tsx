import { useTheme } from '@/components/ThemeContext';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 }}>
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
      <Text style={{ flex: 1, fontSize: 14, color: colors.mutedForeground, lineHeight: 22 }}>{children}</Text>
    </View>
  );
}

function Bold({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={{ fontWeight: '600', color: colors.foreground }}>{children}</Text>;
}

export default function TermsScreen() {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Terms of Service' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
      >
        {/* Header */}
        <View style={{ paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.foreground }}>Terms of Service</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Last updated: April 30, 2026</Text>
        </View>

        <Section title="1. Acceptance of Terms">
          <Para>
            By using CalmGuide, you agree to be bound by these Terms of Service. If you do not
            agree, do not use the service. You must be at least 18 years old to use CalmGuide.
          </Para>
        </Section>

        <Section title="2. Description of Service">
          <Para>
            CalmGuide is an AI-powered coaching tool designed to help dementia caregivers navigate
            difficult behavioral situations. It serves both family caregivers and professional care
            facility staff. The service provides:
          </Para>
          <View style={{ gap: 4 }}>
            <Bullet><Bold>Moment Coach</Bold> — immediate, structured guidance when a behavioral situation is happening</Bullet>
            <Bullet><Bold>Learn Mode</Bold> — scenario-based practice for common dementia caregiving challenges</Bullet>
            <Bullet><Bold>Emotional Check-In</Bold> — empathetic support for caregiver wellbeing</Bullet>
            <Bullet><Bold>Incident Logging</Bold> — structured recording of behavioral incidents with pattern detection</Bullet>
            <Bullet><Bold>Daily Behavioral Log</Bold> — daily tracking that feeds predictive pattern alerts</Bullet>
            <Bullet><Bold>Behavioral Insights</Bold> — personalized pattern analysis, cycle detection, and care-level predictions</Bullet>
          </View>
          <Para>
            For professional care facilities, CalmGuide also provides staff management, resident
            behavioral profiles, dashboard analytics, audit logging, and PDF reporting.
          </Para>
          <Para>
            CalmGuide is a free service for family caregivers. No account creation, subscription,
            or payment is required. Facility access requires a facility code provided by the care
            organization.
          </Para>
        </Section>

        <Section title="3. Not a Medical Service">
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, lineHeight: 22 }}>
            CalmGuide is not a medical service and does not provide medical advice, diagnosis, or treatment.
          </Text>
          <Para>
            The guidance provided is informational and educational only. It is not a substitute for
            professional medical care, licensed clinical advice, or emergency services.
          </Para>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 22 }}>
            <Bold>If you or your loved one is in immediate danger, call 911 or your local emergency number.</Bold>
            {' '}Do not rely on CalmGuide in life-threatening situations.
          </Text>
          <Para>
            CalmGuide includes an automated safety system that detects descriptions of medical
            emergencies and self-harm. When triggered, the system bypasses AI guidance entirely and
            provides emergency contact information appropriate to your language and region. This system
            is not a substitute for calling emergency services.
          </Para>
          <Para>
            Always consult a qualified healthcare provider regarding the medical care of a person
            with dementia.
          </Para>
        </Section>

        <Section title="4. AI-Generated Guidance">
          <Para>
            CalmGuide uses third-party AI services to generate real-time guidance. The active provider
            is configurable and currently includes OpenAI and Anthropic. Responses are enriched with
            information from trusted sources such as the Alzheimer's Association, Mayo Clinic, and
            the CDC. AI-generated responses may still be incomplete, inaccurate, or inappropriate
            for a specific situation.
          </Para>
          <Para>You understand and accept that:</Para>
          <View style={{ gap: 4 }}>
            <Bullet>AI guidance is a supplement to, not a replacement for, professional judgment</Bullet>
            <Bullet>Responses are generated based on the patient profile, the situation you describe, past incident history, and retrieved caregiving guidance</Bullet>
            <Bullet>The accuracy of guidance depends on the accuracy of the information you provide</Bullet>
            <Bullet>Your queries and patient profile data are sent to third-party AI services for processing</Bullet>
            <Bullet>We do not guarantee any particular outcome from following AI guidance</Bullet>
            <Bullet>All AI responses pass through automated quality and safety checks, but these checks are not infallible</Bullet>
          </View>
        </Section>

        <Section title="5. Access Codes & Profiles">
          <Para>
            CalmGuide uses 8-character access codes instead of user accounts. An access code is
            generated when you complete the patient profile setup and is stored on your device.
          </Para>
          <Para>
            Your access code links your device to the clinical profile stored on our servers. You
            are responsible for keeping your access code safe. Anyone with your access code can
            access and modify the patient profile associated with it.
          </Para>
          <Para>
            If you lose your access code, the associated profile cannot be recovered. We do not
            store any information that would allow us to identify you as the owner of an access code.
          </Para>
          <Para>
            For professional care facilities, staff members authenticate via a facility code plus a
            personal PIN or email/password. Facility accounts are managed by the facility administrator
            and are subject to automatic lockout after repeated failed login attempts.
          </Para>
        </Section>

        <Section title="6. Entering Information">
          <Para>
            We encourage you to describe your loved one in <Bold>clinical and behavioral terms</Bold> only — not
            personal ones.
          </Para>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, lineHeight: 22 }}>We recommend you enter:</Text>
          <View style={{ gap: 4 }}>
            <Bullet>Disease stage (e.g. "moderate Alzheimer's")</Bullet>
            <Bullet>Behavioral patterns (e.g. "sundowning after 5pm, refuses bathing")</Bullet>
            <Bullet>What helps (e.g. "classical music, familiar photos calm her")</Bullet>
            <Bullet>Safety notes (e.g. "uses a walker, fall risk")</Bullet>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground, lineHeight: 22 }}>We recommend you do not enter:</Text>
          <View style={{ gap: 4 }}>
            <Bullet>The patient's full name, date of birth, or address</Bullet>
            <Bullet>Medical record numbers, insurance details, or doctor names</Bullet>
            <Bullet>Your own name, contact information, or relationship details</Bullet>
          </View>
          <Para>
            The patient's name is stored <Bold>on your device only</Bold> and is never saved on our
            servers. It is sent to the AI provider during each Moment Coach session to personalize
            guidance, but is not retained after the session ends. Any text you enter into profile
            description fields is stored server-side with encryption.
          </Para>
        </Section>

        <Section title="7. Acceptable Use">
          <Para>You agree not to:</Para>
          <View style={{ gap: 4 }}>
            <Bullet>Use CalmGuide for any unlawful purpose</Bullet>
            <Bullet>Attempt to probe, scan, or test the vulnerability of our systems</Bullet>
            <Bullet>Interfere with or disrupt the service or its infrastructure</Bullet>
            <Bullet>Use automated tools to generate large volumes of requests</Bullet>
            <Bullet>Use the service to generate harmful, abusive, or misleading content</Bullet>
            <Bullet>Attempt to override the AI's safety instructions or guardrails</Bullet>
            <Bullet>Misrepresent the AI guidance as professional medical advice to others</Bullet>
          </View>
        </Section>

        <Section title="8. Your Content & Data">
          <Para>
            The patient profile information you enter is stored on our servers with
            industry-standard encryption, linked only to your access code — not to any personal identifier.
          </Para>
          <Para>
            Conversation history, feedback ratings, daily check-in logs, incident records, and
            derived behavioral insights are also stored with encryption. This data is used to
            personalize future guidance and detect behavioral patterns.
          </Para>
          <Para>
            Your patient's name is stored only on your device. It is sent to the AI provider during
            each Moment Coach session for personalization but is never written to our database.
          </Para>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, lineHeight: 22 }}>
            See our{' '}
            <Text style={{ color: colors.primary }} onPress={() => router.push('/privacy')}>Privacy Policy</Text>
            {' '}for full details.
          </Text>
        </Section>

        <Section title="9. Intellectual Property">
          <Para>
            The CalmGuide application, brand, and underlying technology are our property. The
            patient profile information you enter remains your information.
          </Para>
          <Para>
            You grant us a limited license to process the information you provide solely for the
            purpose of delivering the service, including deriving anonymized aggregate insights
            that may benefit other caregivers.
          </Para>
        </Section>

        <Section title="10. Warranty Disclaimer">
          <Para>
            CalmGuide is provided "as is" and "as available" without warranties of any kind,
            express or implied. We do not warrant that the service will be uninterrupted,
            error-free, or that the AI guidance will be accurate or suitable for any particular
            situation.
          </Para>
          <Para>
            We expressly disclaim any warranty that CalmGuide guidance will prevent harm, resolve
            a crisis, or be appropriate for any specific caregiving situation.
          </Para>
        </Section>

        <Section title="11. Limitation of Liability">
          <Para>
            To the maximum extent permitted by law, we are not liable for any indirect, incidental,
            consequential, or punitive damages arising from your use of CalmGuide, including but
            not limited to any harm resulting from following AI-generated guidance.
          </Para>
          <Para>
            Our total liability for any claim shall not exceed the amount you paid to use
            CalmGuide. As the service is currently free, this amount is zero.
          </Para>
        </Section>

        <Section title="12. Changes to These Terms">
          <Para>
            We may update these terms from time to time. The "Last updated" date at the top of
            this page reflects the most recent revision. Continued use of the service after
            changes constitutes acceptance.
          </Para>
        </Section>

        <View style={{ paddingVertical: 20, gap: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.foreground }}>13. Contact Us</Text>
          <Para>
            For questions about these terms, please reach out through our official contact channels.
          </Para>
        </View>
      </ScrollView>
    </>
  );
}
