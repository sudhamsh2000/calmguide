import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { LegalLayout } from '@/components/ui/LegalLayout';

export const metadata: Metadata = {
  title: 'Terms of Service | CalmGuide',
  description: 'Terms and conditions for using CalmGuide.',
};

const sections = [
  { id: 'acceptance', title: 'Acceptance of Terms' },
  { id: 'description', title: 'Description of Service' },
  { id: 'not-medical', title: 'Not a Medical Service' },
  { id: 'ai-content', title: 'AI-Generated Guidance' },
  { id: 'access-codes', title: 'Access Codes & Profiles' },
  { id: 'entering-information', title: 'Entering Information' },
  { id: 'acceptable-use', title: 'Acceptable Use' },
  { id: 'your-data', title: 'Your Content & Data' },
  { id: 'ip', title: 'Intellectual Property' },
  { id: 'warranty', title: 'Warranty Disclaimer' },
  { id: 'liability', title: 'Limitation of Liability' },
  { id: 'changes', title: 'Changes to These Terms' },
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

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="April 30, 2026" sections={sections}>
      <p className="text-xs text-foreground-muted/60 italic mb-2">
        This document is only available in English.
      </p>

      <Section id="acceptance" title="1. Acceptance of Terms">
        <p>
          By using CalmGuide, you agree to be bound by these Terms of Service. If you do not agree,
          do not use the service. You must be at least 18 years old to use CalmGuide.
        </p>
      </Section>

      <Section id="description" title="2. Description of Service">
        <p>
          CalmGuide is an AI-powered coaching tool designed to help dementia caregivers navigate
          difficult behavioral situations. It serves both family caregivers (B2C) and professional
          care facility staff (B2B). The service provides:
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>
            <strong className="text-foreground">Moment Coach</strong> — immediate, structured
            guidance when a behavioral situation is happening
          </li>
          <li>
            <strong className="text-foreground">Learn Mode</strong> — scenario-based practice for
            common dementia caregiving challenges
          </li>
          <li>
            <strong className="text-foreground">Emotional Check-In</strong> — empathetic support for
            caregiver wellbeing
          </li>
          <li>
            <strong className="text-foreground">Incident Logging</strong> — structured recording of
            behavioral incidents with pattern detection
          </li>
          <li>
            <strong className="text-foreground">Daily Behavioral Log</strong> — daily tracking that
            feeds predictive pattern alerts
          </li>
          <li>
            <strong className="text-foreground">Behavioral Insights</strong> — personalized pattern
            analysis, cycle detection, and care-level predictions
          </li>
        </ul>
        <p>
          For professional care facilities, CalmGuide also provides staff management, resident
          behavioral profiles, dashboard analytics, audit logging, and PDF reporting.
        </p>
        <p>
          CalmGuide is a free service for family caregivers. No account creation, subscription, or
          payment is required. Facility access requires a facility code provided by the care
          organization.
        </p>
      </Section>

      <Section id="not-medical" title="3. Not a Medical Service">
        <p className="font-semibold text-foreground">
          CalmGuide is not a medical service and does not provide medical advice, diagnosis, or
          treatment.
        </p>
        <p>
          The guidance provided is informational and educational only. It is not a substitute for
          professional medical care, licensed clinical advice, or emergency services.
        </p>
        <p>
          <strong className="text-foreground">
            If you or your loved one is in immediate danger, call 911 or your local emergency
            number.
          </strong>{' '}
          Do not rely on CalmGuide in life-threatening situations.
        </p>
        <p>
          CalmGuide includes an automated safety system that detects descriptions of medical
          emergencies and self-harm. When triggered, the system bypasses AI guidance entirely and
          provides emergency contact information appropriate to your language and region. This
          system is not a substitute for calling emergency services.
        </p>
        <p>
          Always consult a qualified healthcare provider regarding the medical care of a person with
          dementia.
        </p>
      </Section>

      <Section id="ai-content" title="4. AI-Generated Guidance">
        <p>
          CalmGuide uses third-party AI services to generate real-time guidance. The active provider
          is configurable and currently includes OpenAI and Anthropic. Responses are enriched with
          information retrieved from publicly available caregiving content from trusted sources such
          as the Alzheimer&apos;s Association, Mayo Clinic, and the CDC. AI-generated responses may
          still be incomplete, inaccurate, or inappropriate for a specific situation.
        </p>
        <p>You understand and accept that:</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>AI guidance is a supplement to, not a replacement for, professional judgment</li>
          <li>
            Responses are generated based on the patient profile, the situation you describe, past
            incident history, and retrieved caregiving guidance
          </li>
          <li>The accuracy of guidance depends on the accuracy of the information you provide</li>
          <li>
            Your queries and patient profile data are sent to third-party AI services for processing
            (see our{' '}
            <Link
              href="/privacy#ai-processing"
              className="text-primary hover:text-primary-light transition-colors"
            >
              Privacy Policy
            </Link>{' '}
            for details)
          </li>
          <li>We do not guarantee any particular outcome from following AI guidance</li>
          <li>
            All AI responses pass through automated quality and safety checks, including language
            validation and a respect filter, but these checks are not infallible
          </li>
        </ul>
      </Section>

      <Section id="access-codes" title="5. Access Codes & Profiles">
        <p>
          CalmGuide uses 8-character access codes instead of user accounts. An access code is
          generated when you complete the patient profile setup and is stored in your browser.
        </p>
        <p>
          Your access code links your browser to the clinical profile stored on our servers. You are
          responsible for keeping your access code safe. Anyone with your access code can access and
          modify the patient profile associated with it.
        </p>
        <p>
          If you lose your access code, the associated profile cannot be recovered. We do not store
          any information that would allow us to identify you as the owner of an access code.
        </p>
        <p>
          For professional care facilities, staff members authenticate via a facility code plus a
          personal PIN or email/password. Facility accounts are managed by the facility
          administrator and are subject to automatic lockout after repeated failed login attempts.
        </p>
      </Section>

      <Section id="entering-information" title="6. Entering Information">
        <p>
          We encourage you to describe your loved one in{' '}
          <strong className="text-foreground">clinical and behavioral terms</strong> only — not
          personal ones. The profile fields are designed to capture what helps the AI give better
          guidance, not to store identifying details.
        </p>
        <p>
          <strong className="text-foreground">We recommend you enter:</strong>
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>Disease stage (e.g. &ldquo;moderate Alzheimer&rsquo;s&rdquo;)</li>
          <li>Behavioral patterns (e.g. &ldquo;sundowning after 5pm, refuses bathing&rdquo;)</li>
          <li>What helps (e.g. &ldquo;classical music, familiar photos calm her&rdquo;)</li>
          <li>Safety notes (e.g. &ldquo;uses a walker, fall risk&rdquo;)</li>
        </ul>
        <p>
          <strong className="text-foreground">We recommend you do not enter:</strong>
        </p>
        <ul className="list-disc ps-5 space-y-1">
          <li>The patient&apos;s full name, date of birth, or address</li>
          <li>Medical record numbers, insurance details, or doctor names</li>
          <li>Your own name, contact information, or relationship details</li>
          <li>Any information you would not want stored on a third-party server</li>
        </ul>
        <p>
          The patient&apos;s name field in the app is stored{' '}
          <strong className="text-foreground">in your browser only</strong> and is never saved on
          our servers. It is sent to the AI provider as part of each Moment Coach session to
          personalize guidance, but it is not retained after the session ends. Any text you enter
          into profile description fields is stored server-side with encryption. We cannot guarantee
          confidentiality of PII you choose to include there.
        </p>
      </Section>

      <Section id="acceptable-use" title="7. Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-disc ps-5 space-y-1">
          <li>Use CalmGuide for any unlawful purpose</li>
          <li>Attempt to probe, scan, or test the vulnerability of our systems</li>
          <li>Interfere with or disrupt the service or its infrastructure</li>
          <li>Use automated tools to generate large volumes of requests</li>
          <li>Use the service to generate harmful, abusive, or misleading content</li>
          <li>Attempt to override the AI&apos;s safety instructions or guardrails</li>
          <li>Misrepresent the AI guidance as professional medical advice to others</li>
        </ul>
      </Section>

      <Section id="your-data" title="8. Your Content & Data">
        <p>
          The patient profile information you enter (disease stage, behavioral patterns, calming
          strategies, safety concerns) is stored on our servers with industry-standard encryption,
          linked only to your access code — not to any personal identifier.
        </p>
        <p>
          Conversation history, feedback ratings, daily check-in logs, incident records, and derived
          behavioral insights are also stored with encryption. This data is used to personalize
          future guidance and detect behavioral patterns.
        </p>
        <p>
          Your patient&apos;s name is stored only in your browser&apos;s local storage. It is sent
          to the AI provider during each Moment Coach session for personalization but is never
          written to our database.
        </p>
        <p>
          See our{' '}
          <Link href="/privacy" className="text-primary hover:text-primary-light transition-colors">
            Privacy Policy
          </Link>{' '}
          for full details on how we handle your information.
        </p>
      </Section>

      <Section id="ip" title="9. Intellectual Property">
        <p>
          The CalmGuide application, brand, and underlying technology are our property. The patient
          profile information you enter remains your information.
        </p>
        <p>
          You grant us a limited license to process the information you provide solely for the
          purpose of delivering the service, including deriving anonymized aggregate insights that
          may benefit other caregivers (see our{' '}
          <Link
            href="/privacy#cross-patient"
            className="text-primary hover:text-primary-light transition-colors"
          >
            Privacy Policy
          </Link>{' '}
          for how cross-patient learning works).
        </p>
      </Section>

      <Section id="warranty" title="10. Warranty Disclaimer">
        <p>
          CalmGuide is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
          warranties of any kind, express or implied. We do not warrant that the service will be
          uninterrupted, error-free, or that the AI guidance will be accurate or suitable for any
          particular situation.
        </p>
        <p>
          We expressly disclaim any warranty that CalmGuide guidance will prevent harm, resolve a
          crisis, or be appropriate for any specific caregiving situation.
        </p>
      </Section>

      <Section id="liability" title="11. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, we are not liable for any indirect, incidental,
          consequential, or punitive damages arising from your use of CalmGuide, including but not
          limited to any harm resulting from following AI-generated guidance.
        </p>
        <p>
          Our total liability for any claim arising from use of the service shall not exceed the
          amount you paid to use CalmGuide in the 12 months preceding the claim. As the service is
          currently free, this amount is zero.
        </p>
      </Section>

      <Section id="changes" title="12. Changes to These Terms">
        <p>
          We may update these terms from time to time. The &ldquo;Last updated&rdquo; date at the
          top of this page reflects the most recent revision. Continued use of the service after
          changes constitutes acceptance.
        </p>
      </Section>

      <section id="contact" className="scroll-mt-6 pt-6">
        <h2 className="text-xl font-bold text-foreground mb-3">13. Contact Us</h2>
        <div className="space-y-3 text-sm text-foreground-muted leading-relaxed">
          <p>
            For questions about these terms, please reach out through our official contact channels.
          </p>
        </div>
      </section>
    </LegalLayout>
  );
}
