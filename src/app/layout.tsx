// app/layout.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import AuthListener from "@/components/AuthListener";
import { auth, db } from "@/lib/firebase/config";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Check if user is admin
      if (user) {
        try {
          const profileRef = doc(db, "profiles", user.uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            setIsAdmin(profileData.role === "admin");
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      document.cookie = "firebase-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      setShowLogoutModal(false);
      setShowDropdown(false);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
      alert("Failed to sign out. Please try again.");
    }
  };

  const getUserDisplayEmail = () => {
    if (!user) return "";
    return user.email || user.displayName || "User";
  };

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="antialiased bg-black text-white">
        {/* Authentication listener (optional) */}
        <AuthListener />

        {/* GLOBAL NAVBAR — single source of truth across the app */}
        <header className="sticky top-0 z-30">
          <div className="backdrop-blur-xl bg-black/30 border-b border-white/6">
            <nav className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3 md:py-4">
              {/* Left: Logo (click to go home) */}
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 via-sky-400 to-emerald-400 flex items-center justify-center text-sm font-bold shadow-[0_0_25px_rgba(56,189,248,0.6)]">
                    ALT
                  </div>
                  <span className="hidden sm:inline font-semibold tracking-wide text-sm md:text-base text-zinc-100">
                    ALT
                  </span>
                </Link>
              </div>

              {/* Center nav links (desktop) */}
              <div className="hidden md:flex items-center gap-6 text-sm text-zinc-300">
                <Link href="/search" className="hover:text-white transition-colors">Book your venue/service</Link>
                <Link href="/add-venue" className="hover:text-white transition-colors">List your service</Link>
                <Link href="/most-popular" className="hover:text-white transition-colors">Most popular</Link>
                <Link href="/top-rated" className="hover:text-white transition-colors">Top rated</Link>
                <Link href="/#about" className="hover:text-white transition-colors">About</Link>
              </div>

              {/* Right: Settings or auth buttons */}
              <div className="flex items-center gap-3 text-sm">
                {user ? (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDropdown(!showDropdown);
                      }}
                      className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 hover:border-white/40 transition-colors hover:bg-white/5"
                      aria-label="Settings"
                    >
                      <Settings size={20} className="text-zinc-200" />
                    </button>
                    
                    {showDropdown && (
                      <>
                        {/* Overlay - rendered first so dropdown can be above it */}
                        <div
                          className="fixed inset-0 z-[45]"
                          onClick={() => setShowDropdown(false)}
                        />
                        {/* Dropdown - rendered after overlay with higher z-index */}
                        <div 
                          className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg overflow-hidden z-[50]"
                        >
                          <div className="px-4 py-3 border-b border-zinc-700">
                            <p className="text-sm text-zinc-300">{getUserDisplayEmail()}</p>
                            {isAdmin && (
                              <p className="text-xs text-amber-400 mt-1 font-semibold">Admin</p>
                            )}
                          </div>
                          {isAdmin && (
                            <Link
                              href="/admin"
                              className="block px-4 py-2 text-sm text-amber-400 hover:bg-zinc-800 transition-colors cursor-pointer relative z-[51] font-semibold"
                              onClick={() => setShowDropdown(false)}
                            >
                              Admin Dashboard
                            </Link>
                          )}
                          <Link
                            href="/add-venue"
                            className="block px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer relative z-[51]"
                            onClick={() => setShowDropdown(false)}
                          >
                            List your service
                          </Link>
                          <Link
                            href="/dashboard/settings?edit=1"
                            className="block px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer relative z-[51]"
                            onClick={() => setShowDropdown(false)}
                          >
                            Edit profile
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setShowLogoutModal(true);
                              setShowDropdown(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer relative z-[51]"
                          >
                            Logout
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <Link
                      href="/auth/signup"
                      className="hidden md:inline-flex px-3 py-1.5 rounded-full border border-white/20 hover:border-white/40 text-zinc-200 hover:text-white transition-colors"
                    >
                      Register
                    </Link>
                    <Link
                      href="/auth"
                      className="px-3 md:px-4 py-1.5 rounded-full bg-white/90 text-black text-sm font-medium hover:bg-white transition-colors"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </header>

        {/* Page content */}
        <main>
          {children}
        </main>

        {/* Footer (optional) */}
        <footer className="border-t border-white/6 mt-12 bg-black/80">
          <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-[11px] md:text-xs text-zinc-400">
            <span>© 2035 ALT. All rights reserved.</span>
            <div className="flex items-center gap-3">
              <Link href="/terms" className="hover:text-zinc-200 transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-zinc-200 transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-zinc-200 transition-colors">Contact</Link>
            </div>
          </div>
        </footer>

        {/* Logout Confirmation Modal */}
        <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
          <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Confirm Logout</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Are you sure you want to logout? You will need to sign in again to access your account.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </body>
    </html>
  );
}
