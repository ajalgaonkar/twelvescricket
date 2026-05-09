"use client";

import Link from "next/link";
import { useState } from "react";
import { teams } from "@/lib/teams";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[rgba(22,22,22,0.9)] backdrop-blur-sm">
      <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/twelvescricket/logo.png"
            alt="Twelves Cricket Club"
            className="h-10 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/teams/copters">Copters</NavLink>
          <NavLink href="/teams/drones">Drones</NavLink>
          <NavLink href="/teams/jets">Jets</NavLink>
          <NavLink href="/teams/rockets">Rockets</NavLink>
          <NavLink href="/schedule">Schedule</NavLink>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-[#f7f7f7] p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-[#161616] border-t border-[#333]">
          <div className="px-6 py-4 flex flex-col gap-4">
            <MobileNavLink href="/" onClick={() => setMobileOpen(false)}>Home</MobileNavLink>
            {teams.map((team) => (
              <MobileNavLink key={team.slug} href={`/teams/${team.slug}`} onClick={() => setMobileOpen(false)}>
                {team.name}
              </MobileNavLink>
            ))}
            <MobileNavLink href="/schedule" onClick={() => setMobileOpen(false)}>Schedule</MobileNavLink>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-[family-name:var(--font-nav)] text-[13px] font-semibold uppercase tracking-[0.071em] text-[#f7f7f7] hover:text-[#7f8080] transition-colors"
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="font-[family-name:var(--font-nav)] text-[14px] font-semibold uppercase tracking-[0.071em] text-[#f7f7f7] hover:text-[#7f8080] transition-colors"
    >
      {children}
    </Link>
  );
}
