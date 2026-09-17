import { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Globe,
  MessageCircle,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
} from "lucide-react";
import { Header } from "@/components/organisms/header/header";
import { Footer } from "@/components/organisms/footer/footer";
import { ContactForm } from "@/components/molecules/forms/contact-form";
import { HandArrow } from "@/components/organisms/landing/sketch/hand-arrow";
import { getPublicSettings } from "@/actions/settings/get-public-settings";
import { auth } from "@/lib/auth";
import { isUserAdmin } from "@/lib/auth-utils";
import { appConfig } from "@/lib/config";
import { buildMetadata } from "@/lib/seo";

import "@/components/organisms/landing/sketch/sketch.css";
import "./contact.css";

export const metadata: Metadata = buildMetadata({
  title: `Contact Us — ${appConfig.name}`,
  description: `Get in touch with ${appConfig.name}. We'd love to hear from you — send us a message, ask a question, or request support.`,
  path: "/contact",
  keywords: ["contact", "support", "help", "get in touch", "customer service"],
});

const SOCIAL_ICONS = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
} as const;

const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  twitter: "Twitter / X",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
};

const FALLBACK_EMAIL = process.env.EMAIL_FROM || "support@example.com";
const FALLBACK_ADDRESS = "Remote-first company, worldwide";

export default async function ContactPage() {
  const [sessionResult, settingsResult] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getPublicSettings(),
  ]);

  const session = sessionResult;
  const isAdmin = await isUserAdmin(session?.user?.id);

  const settings =
    "success" in settingsResult && settingsResult.success
      ? settingsResult.data
      : null;

  const fullAddress = settings
    ? [
        settings.address,
        settings.city,
        settings.state,
        settings.zipCode,
        settings.country,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  const socialLinks = settings
    ? (
        [
          ["facebook", settings.facebook],
          ["twitter", settings.twitter],
          ["instagram", settings.instagram],
          ["linkedin", settings.linkedin],
          ["youtube", settings.youtube],
          ["tiktok", settings.tiktok],
        ] as [string, string][]
      ).filter(([, url]) => Boolean(url))
    : [];

  const contactEmail = settings?.email || FALLBACK_EMAIL;
  const contactAddress = fullAddress || FALLBACK_ADDRESS;

  return (
    <div className="sketch flex min-h-screen flex-col">
      <Header user={session?.user} isAdmin={isAdmin} />

      <main className="flex-1 contact-page">
        <div className="sk-wrap">
          {/* Hero Section */}
          <section className="contact-hero">
            <span className="sk-eyebrow">Get In Touch</span>
            <h1 className="font-display font-extrabold tracking-tight">
              Let&apos;s talk about <span className="sk-hl">your project.</span>
            </h1>
            <p className="contact-hero-lede">
              Have questions about {appConfig.name}, need custom help, or want to explore our platform? We&apos;d love to hear from you.
            </p>
            <div className="contact-hero-badge sk-hand" aria-hidden="true">
              <span>direct human reply, no bot maze</span>
              <HandArrow variant="curve-right" className="contact-hero-arrow" />
            </div>
          </section>

          {/* Main Grid: Contact Info & Form */}
          <div className="contact-grid">
            {/* Info Panel */}
            <aside className="sk-box sk-box-lift contact-info-card">
              <div>
                <span className="sk-eyebrow mb-2 block">Direct Channels</span>
                <h2 className="font-display text-2xl font-bold tracking-tight mb-2">
                  Reach out directly
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {appConfig.description}
                </p>
              </div>

              <ul className="space-y-5 text-sm">
                <li className="contact-item">
                  <div className="contact-icon-box" aria-hidden="true">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="contact-item-label">Email</span>
                    <a
                      href={`mailto:${contactEmail}`}
                      className="contact-item-value contact-link"
                      aria-label={`Email us at ${contactEmail}`}
                    >
                      {contactEmail}
                    </a>
                  </div>
                </li>

                {settings?.phone && (
                  <li className="contact-item">
                    <div className="contact-icon-box" aria-hidden="true">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="contact-item-label">Phone</span>
                      <a
                        href={`tel:${settings.phone}`}
                        className="contact-item-value contact-link"
                        aria-label={`Call us at ${settings.phone}`}
                      >
                        {settings.phone}
                      </a>
                    </div>
                  </li>
                )}

                {settings?.whatsappNumber && (
                  <li className="contact-item">
                    <div className="contact-icon-box" aria-hidden="true">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="contact-item-label">WhatsApp</span>
                      <a
                        href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contact-item-value contact-link"
                        aria-label="Chat with us on WhatsApp"
                      >
                        {settings.whatsappNumber}
                      </a>
                    </div>
                  </li>
                )}

                <li className="contact-item">
                  <div className="contact-icon-box" aria-hidden="true">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="contact-item-label">Location</span>
                    <address className="not-italic contact-item-value text-muted-foreground">
                      {contactAddress}
                    </address>
                  </div>
                </li>

                {settings?.businessHours && (
                  <li className="contact-item">
                    <div className="contact-icon-box" aria-hidden="true">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="contact-item-label">Office Hours</span>
                      <p className="contact-item-value whitespace-pre-line text-muted-foreground">
                        {settings.businessHours}
                      </p>
                    </div>
                  </li>
                )}
              </ul>

              {socialLinks.length > 0 && (
                <>
                  <div className="contact-divider" aria-hidden="true" />
                  <div>
                    <span className="sk-eyebrow mb-3 block">Connect With Us</span>
                    <div className="contact-social-grid">
                      {socialLinks.map(([platform, url]) => {
                        const Icon =
                          SOCIAL_ICONS[platform as keyof typeof SOCIAL_ICONS] ??
                          Globe;
                        return (
                          <Link
                            key={platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="contact-social-pill"
                            aria-label={`Follow us on ${SOCIAL_LABELS[platform] ?? platform}`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{SOCIAL_LABELS[platform] ?? platform}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </aside>

            {/* Form Sheet */}
            <section aria-labelledby="contact-form-title">
              <ContactForm />
            </section>
          </div>

          {/* Google Maps Section */}
          {settings?.googleMapsUrl && (
            <section className="contact-map-section">
              <div className="mb-4">
                <span className="sk-eyebrow mb-1 block">Our Location</span>
                <h2 className="font-display font-bold text-2xl tracking-tight">
                  Find us on the map
                </h2>
              </div>
              <div className="contact-map-frame">
                <iframe
                  src={settings.googleMapsUrl}
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Our location on Google Maps"
                  aria-label="Google Maps showing our location"
                />
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
