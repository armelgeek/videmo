"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { User, CreditCard, LogOut, LayoutDashboard, Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/atoms/buttons/theme-toggle";
import { signOut } from "@/lib/auth-client";
import { appConfig } from "@/lib/config";
import "./header.css";

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    image?: string | null;
  } | null;
  isAdmin?: boolean;
}

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

function Underline() {
  return (
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <path d="M2 5 C 25 1, 55 8, 98 3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Header({ user, isAdmin }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    try {
      await signOut();
      toast.success("You're signed out.");
      router.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out failed.");
    }
  }

  const close = () => setOpen(false);

  return (
    <header className="sk-header">
      <div className="sk-header-inner">
        <Link href="/" className="sk-header-logo">
          <i aria-hidden="true" />
          {appConfig.name}
        </Link>

        <nav className="sk-header-nav" aria-label="Main navigation">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="sk-header-link" aria-current={pathname === l.href ? "page" : undefined}>
              {l.label}
              <Underline />
            </Link>
          ))}
        </nav>

        <div className="sk-header-actions">
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/workspace" className="sk-header-btn is-ghost">My workspace</Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="sk-header-avatar" aria-label="Account menu">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="" />
                    ) : (
                      initials(user.name)
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="cursor-pointer">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          Admin
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/billing" className="cursor-pointer">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-400 focus:text-red-400">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login" className="sk-header-icon" aria-label="Sign in" title="Sign in">
                <User className="h-4 w-4" />
              </Link>
              <Link href="/contact" className="sk-header-btn is-ghost">Book a demo</Link>
              <Link href="/signup" className="sk-header-btn">Create a video →</Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="sk-header-burger"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="sk-header-mobile"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav id="sk-header-mobile" className="sk-header-mobile" aria-label="Mobile navigation">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={close}>{l.label}</Link>
          ))}
          <hr />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px" }}>
            <span>Theme</span>
            <ThemeToggle />
          </div>
          <hr />
          {user ? (
            <>
              <Link href="/workspace" onClick={close}>My workspace</Link>
              {isAdmin && (
                <Link href="/dashboard" onClick={close}><LayoutDashboard className="h-4 w-4" />Admin</Link>
              )}
              <Link href="/profile" onClick={close}><User className="h-4 w-4" />Profile</Link>
              <Link href="/billing" onClick={close}><CreditCard className="h-4 w-4" />Billing</Link>
              <button
                type="button"
                className="sk-header-mobile-item sk-header-danger"
                onClick={() => {
                  close();
                  handleSignOut();
                }}
              >
                <LogOut className="h-4 w-4" />Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/contact" onClick={close} className="sk-header-btn is-ghost">Book a demo</Link>
              <Link href="/signup" onClick={close} className="sk-header-btn">Create a video →</Link>
              <Link href="/login" onClick={close}><User className="h-4 w-4" />Sign in</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
