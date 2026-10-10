import { createMetadata } from "@/lib/metadata";
import { SearchFeaturePage } from "@/components/marketing/SearchFeaturePage";

export const metadata = createMetadata({
  title: "Online RSVP Tracking for Small Events | SealSend",
  description: "Track event replies, plus-ones and dietary notes in one guest list. Guests RSVP through a link without an account. Free beta: one event, up to 100 guests.",
  path: "/rsvp-tracking",
});

export default function RsvpTrackingPage() {
  return <SearchFeaturePage
    eyebrow="Online RSVP tracking"
    title="Know who's coming, without counting replies in the group chat."
    intro="A club dinner, a neighbourhood gathering or a birthday starts with one question: how many people should we plan for? Create a digital invitation in SealSend, share its link and collect replies in one place."
    sections={[
      { title: "Start with one clear invitation", text: "Add the event date, time and location, then preview the invitation before publishing. Share the invitation link through the channels your group already uses. Your guests open it in their browser." },
      { title: "Keep replies separate from the conversation", text: "See who is attending, who is unsure and who cannot make it. Replies update your event's guest list, so you can check the current count without searching through separate messages." },
      { title: "Ask what you need to plan", text: "Include questions about dietary needs or other event details. If your event allows plus-ones, count the people attending as well as the replies. Keep your questions short and relevant to the gathering." },
      { title: "Close the loop before event day", text: "Review unanswered invitations before making final plans. If you send an email update, choose the audience and review the message first. Guests can update their response while the event is accepting replies." },
    ]}
    questions={[
      { title: "Do guests need a SealSend account?", text: "No. Guests can open the invitation link and submit their RSVP without creating an account or installing an app. The host uses an account to manage the event." },
      { title: "Is RSVP tracking free?", text: "The current free beta includes one active event with up to 100 guests. Paid checkout is disabled during the beta. See the pricing page for the current limits." },
      { title: "Is this a ticketing service?", text: "This beta is for invitations, guest replies and check-in. It does not include paid ticket sales or SMS invitations. Sharing your event link yourself is separate from sending a text through SealSend." },
    ]}
    related={[
      { title: "RSVPs for clubs and associations", href: "/use-cases/clubs-associations" },
      { title: "Plan a community event", href: "/use-cases/community-events" },
      { title: "Check guests in from your phone", href: "/qr-event-check-in" },
      { title: "See the free beta limits", href: "/pricing" },
    ]}
  />;
}
