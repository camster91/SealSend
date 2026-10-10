import { createMetadata } from "@/lib/metadata";
import { SearchFeaturePage } from "@/components/marketing/SearchFeaturePage";

export const metadata = createMetadata({
  title: "QR Event Check-in and Guest Lists | SealSend",
  description: "Manage arrivals from your phone with QR guest check-in and manual lookup. Keep invitation replies and check-in together. Free beta: one event, up to 100 guests.",
  path: "/qr-event-check-in",
});

export default function QrEventCheckInPage() {
  return <SearchFeaturePage
    eyebrow="Event guest check-in"
    title="Give your guests a warm welcome, with a calmer guest list."
    intro="Keep invitation replies and event arrivals connected. SealSend gives your check-in team a phone-friendly guest list, QR scanning and a manual option when a guest cannot show their code."
    sections={[
      { title: "Prepare the people at the door", text: "Review your guest list before the gathering and assign the people helping with check-in. Use the check-in role when a helper only needs to manage arrivals, rather than giving everyone full event access." },
      { title: "Scan a guest's QR code", text: "Open event check-in on a phone and allow camera access when prompted. Scan the guest's code and confirm their arrival. Test the actual phone and camera before your first event; browser checks cannot prove every device combination." },
      { title: "Keep a manual option ready", text: "A flat battery or a camera permission problem should not hold up the queue. Use guest lookup and manual check-in when scanning is unavailable. Check the guest's name carefully before marking the arrival." },
      { title: "Plan for your connection", text: "Use a reliable internet connection at the venue and keep a charged phone ready. Do not rely on offline scanning: the beta does not promise offline check-in. Give the team a simple fallback plan before doors open." },
    ]}
    questions={[
      { title: "Do I need a separate scanner?", text: "SealSend's check-in flow runs in a phone browser and uses its camera. Camera access and QR reading depend on the device and browser, so test your own setup before using it at the door." },
      { title: "Can someone else help with check-in?", text: "Yes. Workspaces support a check-in role for helpers. Give each helper the access needed for the event and verify that they can open the guest list before guests arrive." },
      { title: "What does the beta include?", text: "One active event with up to 100 guests, including the invitation, RSVP and check-in workflow. Paid ticket sales and SMS are unavailable during this beta." },
    ]}
    related={[
      { title: "Track replies before the event", href: "/rsvp-tracking" },
      { title: "See the complete invitation workflow", href: "/how-it-works" },
      { title: "Run a club or association event", href: "/use-cases/clubs-associations" },
      { title: "Get help with your event", href: "/support" },
    ]}
  />;
}
