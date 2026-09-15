import Link from "next/link";
import { appConfig } from "@/lib/config";

const PRODUCT_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const LINK_CLASS =
  "text-sm text-muted-foreground underline-offset-4 decoration-highlight decoration-[3px] transition-colors hover:text-foreground hover:underline";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-1 border-t-2 border-ink bg-background shadow-[0_-4px_0_hsl(var(--highlight))]">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-foreground"
            >
              <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-ink bg-highlight" />
              {appConfig.name}
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Hand-drawn explainer videos from a script: storyboard, whiteboard animation and synced voiceover.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex h-9 items-center rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px"
            >
              Start for free
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-16">
            <nav aria-label="Product">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Product</h2>
              <ul className="space-y-2">
                {PRODUCT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={LINK_CLASS}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Legal">
              <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">Legal</h2>
              <ul className="space-y-2">
                {appConfig.nav.legal.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={LINK_CLASS}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="font-mono text-xs text-muted-foreground">
            © {currentYear} {appConfig.company.name}. All rights reserved.
          </p>
          {appConfig.company.twitter && (
            <a
              href={appConfig.company.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_CLASS}
            >
              X / Twitter
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
