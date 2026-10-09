import type { ContactSubject } from "@/lib/types/contact";

export const CONTACT_PHONE = "+92 325-4577969";
export const CONTACT_WHATSAPP = "+92 325-4577969";
export const CONTACT_ADDRESS = "Zarrar Shaheed Road, Jorry Pul, Lahore Cantt.";
export const CONTACT_HOURS = "Mon-Sat 09 AM-06 PM";
export const CONTACT_EMAIL_DISPLAY = "info@vizauraglobal.com";

export const CONTACT_SUBJECT_OPTIONS: { label: string; value: ContactSubject }[] = [
  { label: "General Inquiry", value: "general" },
  { label: "Product Question", value: "product" },
  { label: "Order Support", value: "order_support" },
  { label: "Wholesale / Bulk Order", value: "wholesale" },
  { label: "Business / Partnership", value: "business" },
];

export const TRUST_ITEMS: { icon: "zap" | "shield" | "globe"; label: string; description: string }[] = [
  { icon: "zap", label: "Quick Response", description: "Within 24 hours" },
  { icon: "shield", label: "Trusted Support", description: "Your satisfaction matters" },
  { icon: "globe", label: "Global Reach", description: "Serving worldwide" },
];

export const CONTACT_INFO_ROWS: {
  icon: "mapPin" | "phone" | "mail" | "whatsapp";
  label: string;
  value: string;
  sub: string;
}[] = [
  { icon: "mapPin", label: "Our Location", value: CONTACT_ADDRESS, sub: "" },
  { icon: "phone", label: "Phone Support", value: CONTACT_PHONE, sub: `(${CONTACT_HOURS})` },
  { icon: "mail", label: "Email Us", value: CONTACT_EMAIL_DISPLAY, sub: "We reply within 24 hours." },
  { icon: "whatsapp", label: "WhatsApp", value: CONTACT_WHATSAPP, sub: "Chat with us for quick support." },
];

export const SOCIAL_PLATFORMS_CONTACT: { label: string; platform: "facebook" | "instagram" | "youtube" | "x" | "linkedin"; href: string }[] = [
  { label: "Facebook", platform: "facebook", href: "https://facebook.com" },
  { label: "Instagram", platform: "instagram", href: "https://instagram.com" },
  { label: "YouTube", platform: "youtube", href: "https://youtube.com" },
  { label: "X", platform: "x", href: "https://x.com" },
  { label: "LinkedIn", platform: "linkedin", href: "https://linkedin.com" },
];

export const FAQ_ITEMS: { id: string; question: string; answer: string }[] = [
  {
    id: "shipping-time",
    question: "How long does shipping take?",
    answer:
      "Orders within Pakistan typically arrive in 3-5 business days, and UAE orders in 5-7 business days, depending on your location.",
  },
  {
    id: "international-shipping",
    question: "Do you ship internationally?",
    answer: "Currently we ship within Pakistan and the UAE. We're working on expanding to more markets soon.",
  },
  {
    id: "payment-methods",
    question: "What payment methods do you accept?",
    answer: "We accept major credit/debit cards, and cash on delivery where available, depending on your market.",
  },
  {
    id: "returns",
    question: "Can I return or exchange my order?",
    answer: "Yes — unopened items can be returned within our return window. See our Return & Refund Policy for details.",
  },
  {
    id: "lab-tested",
    question: "Is your Shilajit lab tested?",
    answer: "Yes, every batch of our Himalayan Shilajit is lab tested for purity and authenticity before it ships.",
  },
];

export const OFFICE_ADDRESS = CONTACT_ADDRESS;
export const OFFICE_HOURS = `${CONTACT_HOURS} (Closed on weekends)`;
export const OFFICE_MAP_QUERY = "Lahore Cantt, Lahore, Pakistan";
