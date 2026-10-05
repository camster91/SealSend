import FaqList, { type Faq } from "@/components/marketing/FaqList";

export default function UseCaseFAQ({ faqs }: { faqs: Faq[] }) {
  return <FaqList faqs={faqs} />;
}
