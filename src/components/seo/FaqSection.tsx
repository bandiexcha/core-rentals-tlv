import { JsonLd } from "@/components/seo/JsonLd";
import { faqSchema, type FaqItem } from "@/lib/json-ld";

export function FaqSection({
  title = "Frequently asked questions",
  faqs,
  className = "",
}: {
  title?: string;
  faqs: FaqItem[];
  className?: string;
}) {
  return (
    <section className={className} aria-labelledby="faq-heading">
      <JsonLd data={faqSchema(faqs)} />
      <h2 id="faq-heading" className="font-serif text-2xl text-navy sm:text-3xl">
        {title}
      </h2>
      <dl className="mt-8 space-y-6">
        {faqs.map((faq) => (
          <div
            key={faq.question}
            className="rounded-2xl bg-cream p-6 ring-1 ring-sand-dark/40"
          >
            <dt className="font-medium text-navy">{faq.question}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted">
              {faq.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
