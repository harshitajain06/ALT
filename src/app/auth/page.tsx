// src/app/auth/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/config";
import { signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const [identifier, setIdentifier] = useState(""); // email or username for signin
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const router = useRouter();

  // Check if user is already signed in and redirect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in, redirect to home page
        router.push("/");
      } else {
        // User is not signed in, allow them to see the auth page
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function lookupEmailFromUsername(input: string) {
    if (!input) return null;
    if (input.includes("@")) return input;
    const profilesRef = collection(db, "profiles");
    const q = query(profilesRef, where("username", "==", input));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data().email ?? null;
    }
    return null;
  }

  // SIGN IN (email or username + password)
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const email = (await lookupEmailFromUsername(identifier)) ?? identifier;
      if (!email || !password) {
        alert("Please provide email/username and password.");
        return;
      }

      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error: any) {
        alert(error.message);
        return;
      }

      // successful sign in — AuthListener will redirect to home page
      router.push("/");
    } finally {
      setLoading(false);
    }
  }


  // Forgot password (email)
  async function handleForgotPassword() {
    if (!identifier) {
      alert("Enter your email or username to reset password.");
      return;
    }
    const email = identifier.includes("@") ? identifier : await lookupEmailFromUsername(identifier);
    if (!email) {
      alert("No email found for that username.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/auth`,
      });
      alert("Password reset email sent. Check your inbox.");
    } catch (error: any) {
      alert(error.message);
    }
  }

  // Show loading state while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
      <div className="w-full max-w-lg bg-[#07102a]/80 border border-zinc-800 rounded-xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Sign in</h1>

        <form onSubmit={handleSignIn} className="space-y-4">
          <label className="block text-sm text-zinc-300">
            Email or Username
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="mt-2 w-full rounded-md bg-zinc-900 border border-zinc-700 p-2"
              placeholder="you@example.com or username"
              autoComplete="username"
            />
          </label>

          <label className="block text-sm text-zinc-300 relative">
            Password
            <div className="mt-2 relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                className="w-full rounded-md bg-zinc-900 border border-zinc-700 p-2 pr-10"
                placeholder="Your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 rounded-md">
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <button type="button" onClick={handleForgotPassword} className="text-sm text-zinc-400 underline">
              Forgot password?
            </button>
          </div>
        </form>

        <p className="text-sm text-zinc-400 mt-6 text-center">
          Don't have an account?{" "}
          <button onClick={() => router.push("/auth/signup")} className="text-emerald-400 underline hover:text-emerald-300">
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
