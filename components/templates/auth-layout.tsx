import type { ReactNode } from "react"
import Link from "next/link"
import { Header } from "@/components/organisms/header/header"
import { Footer } from "@/components/organisms/footer/footer"
import { HandArrow } from "@/components/organisms/landing/sketch/hand-arrow"
import { appConfig } from "@/lib/config"
import { isGoogleEnabled } from "@/lib/auth"
import { GoogleButton } from "@/components/molecules/forms/google-button"
import "@/components/organisms/landing/sketch/sketch.css"
import "./auth.css"

interface AuthLayoutProps {
  children: ReactNode
  mode: "login" | "signup"
  redirectTo?: string
}

const COPY = {
  login: {
    eyebrow: "Welcome back",
    title: <>Pick up <span className="sk-hl">where you left off.</span></>,
    lede: "Your projects, scenes and voiceovers are waiting in your workspace.",
    note: "your drafts are saved",
    sheet: "Sign in",
  },
  signup: {
    eyebrow: "Create your account",
    title: <>From script to video, <span className="sk-hl">drawn by hand.</span></>,
    lede: `Paste your text and ${appConfig.name} turns it into a whiteboard explainer with a synced voiceover.`,
    note: "takes less than a minute",
    sheet: "Sign up",
  },
}

const POINTS = [
  "AI storyboard you can edit scene by scene",
  "Voiceover synced to the drawing, word by word",
  "Export in 16:9, 9:16 and 1:1 from one project",
]

const DOODLES = [
  { d: "M6 8 h36 v24 h-36 z M14 32 l-4 12 M34 32 l4 12 M24 32 v6 M12 24 c6 -8 10 4 16 -4 s8 2 10 -2", top: "9%", left: "3%", size: 84, rot: -8 },
  { d: "M12 40 l-4 4 M10 34 l4 4 l22 -22 l-4 -4 z M28 12 l4 -4 l8 8 l-4 4", top: "12%", left: "92%", size: 56, rot: 12 },
  { d: "M18 8 h12 v18 a6 6 0 0 1 -12 0 z M12 22 a12 12 0 0 0 24 0 M24 34 v8 M16 42 h16", top: "46%", left: "2%", size: 52, rot: -6 },
  { d: "M4 14 h22 v13 h-22 z M30 10 h9 v16 h-9 z M30 32 h12 v12 h-12 z", top: "58%", left: "93%", size: 64, rot: 6 },
  { d: "M6 20 h10 M20 20 h14 M38 20 h4 M6 28 h16 M26 28 h10 M16 34 c6 3 14 3 20 0", top: "82%", left: "7%", size: 60, rot: 4 },
  { d: "M10 8 h28 v22 l-10 10 h-18 z M38 30 h-10 v10 M15 16 h16 M15 22 h10", top: "86%", left: "88%", size: 50, rot: -10 },
  { d: "M6 10 h36 v28 h-36 z M20 18 v12 l10 -6 z", top: "90%", left: "42%", size: 48, rot: 3 },
]

function AuthDoodles() {
  return (
    <div className="auth-doodles" aria-hidden="true">
      {DOODLES.map((x) => (
        <span
          key={x.d}
          className="auth-doodle"
          style={{ top: x.top, left: x.left, width: x.size, transform: `rotate(${x.rot}deg)` }}
        >
          <svg viewBox="0 0 48 48">
            <path d={x.d} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ))}
    </div>
  )
}

export function AuthLayout({ children, mode, redirectTo }: AuthLayoutProps) {
  const c = COPY[mode]
  const q = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""

  const isCodeFlow = typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).has('code')

  return (
    <div className="sketch">
      <Header />
      <div className="auth-bg">
      <AuthDoodles />
      <main className="sk-wrap auth">
        {!isCodeFlow && <div className="auth-copy">
          <p className="sk-eyebrow">{c.eyebrow}</p>
          <h1>{c.title}</h1>
          <p className="auth-lede">{c.lede}</p>
          {mode === "signup" && (
            <ul className="auth-points">
              {POINTS.map((p) => (
                <li key={p}><span className="sk-yes" aria-hidden="true">✓</span>{p}</li>
              ))}
            </ul>
          )}
          <div className="auth-note" aria-hidden="true">
            <span className="sk-note">{c.note}</span>
            <HandArrow variant="right" className="auth-note-arrow" />
          </div>
        </div>}

        <div className={isCodeFlow ? "auth-sheet is-full" : "auth-sheet"}>
          <span className="shot-tape" aria-hidden="true" />
          <p className="sk-eyebrow auth-sheet-title">{c.sheet}</p>
          {isGoogleEnabled && (
            <>
              <GoogleButton redirectTo={redirectTo} />
              <p className="auth-or"><span className="sk-hand">or with your email</span></p>
            </>
          )}
          {children}
          <p className="auth-switch">
            {mode === "login" ? (
              <>New here? <Link href={`/signup${q}`}>Create an account →</Link></>
            ) : (
              <>Already have an account? <Link href={`/login${q}`}>Sign in →</Link></>
            )}
          </p>
          <p className="auth-legal">
            By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
      </div>
      <Footer />
    </div>
  )
}
