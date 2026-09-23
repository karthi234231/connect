import { PageHeader } from '@/components/layout/PageHeader'

const sections: { title: string; body: string }[] = [
  {
    title: 'Account eligibility',
    body: "You must be at least 18 years old and able to enter into a binding agreement to use Connect. You're responsible for keeping your account credentials safe and for the activity that happens under them.",
  },
  {
    title: 'Acceptable use',
    body: "Use Connect to build, match, and coordinate in good faith. Don't spam, scrape, impersonate, or harass others, and don't post content that is unlawful, deceptive, or misleading.",
  },
  {
    title: 'Events',
    body: 'Event organizers are responsible for their listings, venues, and messaging. As an attendee or organizer you agree to be respectful at events, in person and online, and to follow applicable local laws.',
  },
  {
    title: 'Content',
    body: 'You keep the rights to content you post, and you grant Connect a license to store and display it so the network can function. We may remove content that violates these terms or the law.',
  },
  {
    title: 'Changes to terms',
    body: 'We may update these terms from time to time. Significant changes will be communicated through the app before they take effect, and continued use after that means you accept the updated terms.',
  },
  {
    title: 'Contact',
    body: "Questions about these terms? Write to legal@connect.example and we'll get back to you within 30 days.",
  },
]

export default function TermsPage() {
  return (
    <div className="cx-page-enter">
      <PageHeader
        title="Terms"
        description="The ground rules for using Connect and being part of the network."
      />
      <div className="max-w-xl space-y-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-lg font-semibold tracking-[-.02em]">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--cx-text-3)]">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  )
}
