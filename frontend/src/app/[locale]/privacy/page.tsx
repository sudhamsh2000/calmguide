import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { LegalLayout } from '@/components/ui/LegalLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy | CalmGuide',
  description: 'How CalmGuide handles your information.',
};

const sections = [
  { id: 'overview', title: 'Privacy at a Glance' },
  { id: 'what-we-collect', title: 'What We Collect' },
  { id: 'what-we-dont', title: "What We Don't Collect" },
  { id: 'how-we-use', title: 'How We Use Your Information' },
  { id: 'ai-processing', title: 'AI Processing' },
  { id: 'cross-patient', title: 'Cross-Patient Learning' },
  { id: 'cookies', title: 'Cookies & Local Storage' },
  { id: 'data-retention', title: 'Data Retention & Deletion' },
  { id: 'data-security', title: 'Data Security' },
  { id: 'your-rights', title: 'Your Rights' },
  { id: 'children', title: "Children's Privacy" },
  { id: 'changes', title: 'Changes to This Policy' },
  { id: 'contact', title: 'Contact Us' },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 py-6 border-b border-theme">
      <h2 className="text-xl font-bold text-foreground mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-foreground-muted leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="April 30, 2026" sections={sections}>
      <p className="text-xs text-foreground-muted/60 italic mb-2">
        This document is only available in English.
      </p>

      <Section id="overview" title="1. Privacy at a Glance">
        <p>
          CalmGuide is designed with privacy as a foundation — not an afterthought. Here is the
          short version:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            Your patient&apos;s{' '}
            <strong className="text-foreground">name is stored only in your browser</strong> — it is
            sent to the AI provider during sessions for personalization but is never saved on our
            servers
          </li>
          <li>
            Patient profiles are stored on our servers{' '}
            <strong className="text-foreground">linked only to an access code</strong>, not to you
          </li>
          <li>
            We do not require an account, email address, or any personal identifier (for family
            caregivers)
          </li>
          <li>
            All sensitive data is <strong className="text-foreground">encrypted at rest</strong>{' '}
            using industry-standard encryption
          </li>
          <li>
            We use <strong className="text-foreground">one functional cookie</strong> (theme
            preference) — no tracking or advertising cookies
          </li>
          <li>
            Your conversations are processed by AI services (OpenAI and/or Anthropic) and are{' '}
            <strong className="text-foreground">not used to train AI models</strong>
          </li>
          <li>
            Cross-patient learning uses{' '}
            <strong className="text-foreground">anonymized, aggregate data only</strong> — no
            personal information crosses patient boundaries
          </li>
        </ul>
      </Section>

      <Section id="what-we-collect" title="2. What We Collect">
        <h3 className="font-semibold text-foreground text-base">
          Patient Profile (server-side, encrypted)
        </h3>
        <p>
          When you complete the profile setup, we store the following on our servers, linked only to
          your access code:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>Disease stage</li>
          <li>Behavioral patterns and triggers</li>
          <li>Known calming strategies</li>
          <li>Safety concerns and mobility notes</li>
        </ul>
        <p>
          This information is associated with an 8-character access code and encrypted with
          industry-standard encryption. We have no way to connect it to your identity.
        </p>
        <div className="rounded-lg border border-theme bg-surface p-4 space-y-2">
          <p className="font-semibold text-foreground text-base">A note on what to enter</p>
          <p>
            We encourage you to use{' '}
            <strong className="text-foreground">clinical and behavioral descriptions</strong> only —
            not personal identifiers. Profile fields are designed for information like
            &ldquo;moderate Alzheimer&rsquo;s, sundowning after 5pm&rdquo; not names, dates of
            birth, or addresses.
          </p>
          <p>
            <strong className="text-foreground">Please avoid entering:</strong>
          </p>
          <ul className="list-disc ps-5 space-y-1">
            <li>The patient&apos;s full name, date of birth, or home address</li>
            <li>Medical record numbers, insurance IDs, or doctor names</li>
            <li>Your own name, email, or contact information</li>
          </ul>
          <p>
            The patient name field in the app is stored{' '}
            <strong className="text-foreground">in your browser only</strong> and is never saved to
            our database. It is sent to the AI provider during each Moment Coach session to
            personalize guidance, but is not retained after the session ends. Any text entered into
            profile description fields is stored server-side (encrypted) linked to your access code.
          </p>
        </div>

        <h3 className="font-semibold text-foreground text-base mt-4">
          Conversation History (server-side, encrypted)
        </h3>
        <p>
          When you use Moment Coach, your messages and the AI&apos;s responses are stored on our
          servers with encryption, linked to your access code. This data is used to:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>Provide conversation context when you send follow-up messages</li>
          <li>Display your conversation history on the home screen</li>
          <li>Detect behavioral patterns and compute personalized insights</li>
          <li>Automatically extract structured incident records from conversations</li>
        </ul>

        <h3 className="font-semibold text-foreground text-base mt-4">
          Feedback &amp; Behavioral Data (server-side, encrypted)
        </h3>
        <p>
          The following data is also stored with encryption to improve the personalization of future
          guidance:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            <strong className="text-foreground">Feedback ratings</strong> — your thumbs-up/down
            ratings and strategy tags on AI responses
          </li>
          <li>
            <strong className="text-foreground">Daily check-in logs</strong> — the daily behavioral
            state you report (e.g. &ldquo;calm day&rdquo; or &ldquo;tough episode&rdquo;)
          </li>
          <li>
            <strong className="text-foreground">Incident records</strong> — structured behavioral
            incidents you log or that are auto-extracted from conversations
          </li>
          <li>
            <strong className="text-foreground">Behavioral dossier</strong> — a derived summary of
            what works and what doesn&apos;t for this patient, computed from incident data
          </li>
          <li>
            <strong className="text-foreground">Care change events</strong> — medication or care
            changes you log, with observation windows
          </li>
          <li>
            <strong className="text-foreground">Profile insights</strong> — computed behavioral
            patterns, cycle detection, and risk scores
          </li>
        </ul>

        <h3 className="font-semibold text-foreground text-base mt-4">Technical Data</h3>
        <p>
          Standard server logs may include IP addresses, request timestamps, and HTTP status codes
          for operational and security purposes. This data is not used to identify or profile users.
        </p>

        <h3 className="font-semibold text-foreground text-base mt-4">
          Facility Staff Data (B2B only)
        </h3>
        <p>
          For professional care facilities, staff member information (name, email, role, login
          timestamps) is stored and managed by the facility administrator. All facility actions are
          recorded in an audit log for compliance purposes. Staff authentication uses securely
          hashed PINs or passwords with automatic lockout after repeated failed attempts.
        </p>
      </Section>

      <Section id="what-we-dont" title="3. What We Don't Collect">
        <ul className="list-disc ps-5 space-y-1">
          <li>Your name (for family caregivers) — no account system exists</li>
          <li>The patient&apos;s name on our servers — it is stored in your browser only</li>
          <li>Email address (for family caregivers) — no account system exists</li>
          <li>Payment or billing information — the service is free for family caregivers</li>
          <li>Location data</li>
          <li>Device identifiers or advertising IDs</li>
          <li>Cross-site tracking data</li>
        </ul>
      </Section>

      <Section id="how-we-use" title="4. How We Use Your Information">
        <p>We use the information we collect solely to:</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>Retrieve your patient profile when you enter your access code</li>
          <li>
            Inject the patient profile, past incidents, and behavioral insights into AI prompts to
            generate personalized guidance
          </li>
          <li>Display your conversation history and behavioral patterns on the home screen</li>
          <li>Detect episode cycles and generate predictive care-level alerts</li>
          <li>
            Compute anonymized cross-patient strategy effectiveness (see{' '}
            <a
              href="#cross-patient"
              className="text-primary hover:text-primary-light transition-colors"
            >
              Cross-Patient Learning
            </a>
            )
          </li>
          <li>Operate, maintain, and improve the security of the service</li>
        </ul>
        <p>
          We do not sell, rent, or share your information with third parties for advertising,
          marketing, or any commercial purpose.
        </p>
      </Section>

      <Section id="ai-processing" title="5. AI Processing">
        <p>
          CalmGuide uses third-party AI services to generate guidance. The active provider is
          configurable per deployment and currently includes:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            <strong className="text-foreground">OpenAI</strong> — for generating chat responses
            (Moment Coach, Learn Mode, and Emotional Check-In), for embedding queries to retrieve
            relevant caregiving guidance, and for extracting structured incident data from
            conversations
          </li>
          <li>
            <strong className="text-foreground">Anthropic (Claude)</strong> — available as an
            alternative provider for all AI features
          </li>
        </ul>

        <h3 className="font-semibold text-foreground text-base mt-4">
          What is sent to these services
        </h3>
        <p>
          When you use Moment Coach, Learn Mode, or Emotional Check-In, the following may be sent to
          the active AI provider:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>Your description of the current situation or your practice response</li>
          <li>
            The patient&apos;s clinical profile (disease stage, behavioral patterns, calming
            strategies, safety concerns)
          </li>
          <li>
            The patient&apos;s name (from your browser&apos;s local storage) — used to personalize
            the AI&apos;s response. The name is included in the prompt sent to the AI provider but
            is <strong className="text-foreground">never stored on our servers</strong>
          </li>
          <li>Relevant past incidents and behavioral dossier data</li>
          <li>Relevant caregiving guidance retrieved from our knowledge base</li>
          <li>
            Anonymized cross-patient strategy data (e.g. &ldquo;6 of 8 similar caregivers found
            music helpful&rdquo;)
          </li>
          <li>Conversation history within the current session for context continuity</li>
          <li>A system prompt that defines how the AI should respond, including safety rules</li>
        </ul>

        <h3 className="font-semibold text-foreground text-base mt-4">Knowledge base (RAG)</h3>
        <p>
          To provide more accurate guidance, CalmGuide maintains a knowledge base of publicly
          available caregiving content from trusted sources including the Alzheimer&apos;s
          Association, Mayo Clinic, HelpGuide, Family Caregiver Alliance, and the CDC. When you
          submit a query, your message is sent to OpenAI&apos;s embedding service to find relevant
          guidance from this knowledge base. For non-English queries, the message is first
          translated to English for retrieval, since the knowledge base is English-only. This
          embedding request contains only your query text — not your patient profile.
        </p>

        <h3 className="font-semibold text-foreground text-base mt-4">
          AI provider privacy policies
        </h3>
        <p>
          These providers process data under their own privacy policies. Per their API terms, data
          submitted via their APIs is not used to train their models:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            <a
              href="https://openai.com/policies/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-light transition-colors"
            >
              OpenAI Privacy Policy
            </a>
          </li>
          <li>
            <a
              href="https://www.anthropic.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-light transition-colors"
            >
              Anthropic Privacy Policy
            </a>
          </li>
        </ul>
      </Section>

      <Section id="cross-patient" title="6. Cross-Patient Learning">
        <p>
          CalmGuide uses anonymized, aggregate data from all caregivers to improve guidance for
          everyone. This works as follows:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            When you rate a response as helpful and select strategy tags (e.g. &ldquo;music,&rdquo;
            &ldquo;calm approach&rdquo;), those tags are counted at the cohort level
          </li>
          <li>
            Patients are grouped into cohorts by disease stage and peak episode time (e.g.
            &ldquo;middle-stage, overnight episodes&rdquo;)
          </li>
          <li>
            Only 12 predefined strategy tags cross patient boundaries — no free-text or custom tags
          </li>
          <li>
            Cross-patient data is only surfaced when a cohort contains{' '}
            <strong className="text-foreground">at least 5 patients</strong> (k-anonymity)
          </li>
          <li>
            No patient names, profile IDs, access codes, or individual data points appear in the
            cross-patient table
          </li>
          <li>Strategy order is randomized in each AI prompt to prevent feedback loops</li>
        </ul>
        <p>
          The result: a new caregiver sees &ldquo;6 of 8 caregivers with similar patients found
          music helpful&rdquo; without any individual patient&apos;s data being exposed.
        </p>
      </Section>

      <Section id="cookies" title="7. Cookies & Local Storage">
        <h3 className="font-semibold text-foreground text-base">Cookies</h3>
        <p>We use one cookie:</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            <strong className="text-foreground">calmguide_theme</strong> — stores your display
            preference (light or dark mode). This is a functional cookie with a 1-year expiry. It is
            not used for tracking.
          </li>
        </ul>
        <p>We do not use analytics cookies, advertising cookies, or third-party tracking pixels.</p>

        <h3 className="font-semibold text-foreground text-base mt-4">Browser Local Storage</h3>
        <p>Your browser&apos;s local storage holds:</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            <strong className="text-foreground">Patient name</strong> — stored locally so it can be
            displayed in the app and sent to the AI provider for personalization. Never saved to our
            database.
          </li>
          <li>
            <strong className="text-foreground">Access code</strong> — stored so you don&apos;t need
            to re-enter it on each visit.
          </li>
          <li>
            <strong className="text-foreground">Language preference</strong> — your selected
            language for the interface.
          </li>
          <li>
            <strong className="text-foreground">Medical disclaimer acknowledgment</strong> — whether
            you have acknowledged the disclaimer.
          </li>
        </ul>
        <p>
          For facility staff, local storage also holds a JWT authentication token (auto-expires),
          facility code, and staff profile information.
        </p>
        <p>
          You can clear this data at any time by clearing your browser&apos;s local storage or using
          your browser&apos;s privacy/incognito mode.
        </p>
      </Section>

      <Section id="data-retention" title="8. Data Retention & Deletion">
        <p>
          Patient profiles, conversation history, incident records, and derived insights are
          retained indefinitely while associated with an active access code. Since we cannot
          identify you, we cannot proactively delete your data — but you can request deletion by
          providing your access code (see{' '}
          <a
            href="#your-rights"
            className="text-primary hover:text-primary-light transition-colors"
          >
            Your Rights
          </a>
          ).
        </p>
        <p>
          Server logs are retained for up to 30 days for operational purposes. Facility audit logs
          are retained for compliance purposes as configured by the facility administrator.
        </p>
      </Section>

      <Section id="data-security" title="9. Data Security">
        <p>We take reasonable steps to protect your information:</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>All data is encrypted in transit (HTTPS/TLS)</li>
          <li>
            All sensitive data is <strong className="text-foreground">encrypted at rest</strong>{' '}
            using industry-standard encryption — including conversations, profile data, feedback,
            incidents, daily logs, and behavioral insights
          </li>
          <li>
            Access codes are securely hashed — we store only the hash, never the plaintext code
          </li>
          <li>Facility staff PINs and passwords are securely hashed</li>
          <li>
            Auto-extracted incident narratives are scrubbed of third-party personally identifiable
            information (names, doctor names, locations) before storage
          </li>
          <li>
            Access codes are the sole credential linking a browser to a profile — there is no
            account to compromise
          </li>
        </ul>
        <p>
          No system is 100% secure. While we strive to protect your information, we cannot guarantee
          absolute security. The design of CalmGuide — no names on our servers, no emails, no
          accounts, encryption at rest — limits the sensitivity of any data breach.
        </p>
      </Section>

      <Section id="your-rights" title="10. Your Rights">
        <p>You have the right to:</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            <strong className="text-foreground">Access</strong> — request the profile data
            associated with your access code
          </li>
          <li>
            <strong className="text-foreground">Correction</strong> — update your patient profile at
            any time via the app
          </li>
          <li>
            <strong className="text-foreground">Deletion</strong> — request deletion of the profile
            and all associated data (conversations, incidents, insights, feedback) linked to your
            access code
          </li>
        </ul>
        <p>
          Because we have no way to verify your identity, deletion requests require you to provide
          your access code. Contact us through our official contact channels with your request.
        </p>
      </Section>

      <Section id="children" title="11. Children's Privacy">
        <p>
          CalmGuide is intended for adult caregivers (18+). We do not knowingly collect information
          from anyone under 18. If you believe a minor has used the service, contact us and we will
          delete the associated data.
        </p>
      </Section>

      <Section id="changes" title="12. Changes to This Policy">
        <p>
          We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the
          top of this page reflects the most recent revision. Continued use of the service after
          changes constitutes acceptance.
        </p>
        <p>
          For significant changes we will update the date prominently. We encourage you to review
          this policy periodically.
        </p>
      </Section>

      <section id="contact" className="scroll-mt-6 pt-6">
        <h2 className="text-xl font-bold text-foreground mb-3">13. Contact Us</h2>
        <div className="space-y-3 text-sm text-foreground-muted leading-relaxed">
          <p>
            For privacy questions, data access or deletion requests, or any concerns about how we
            handle your information, please reach out through our official contact channels.
          </p>
          <p>
            See also our{' '}
            <Link href="/terms" className="text-primary hover:text-primary-light transition-colors">
              Terms of Service
            </Link>
            .
          </p>
        </div>
      </section>
    </LegalLayout>
  );
}
