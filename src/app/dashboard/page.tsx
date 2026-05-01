"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Eye, EyeOff } from "lucide-react";

export default function AuthPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // helper: attempt to find email in profiles (if user passed username)
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
        const { signInWithEmailAndPassword } = await import("firebase/auth");
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/");
      } catch (error: any) {
        alert(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupPhone(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!phone) {
        alert("Enter phone with country code, e.g. +919876543210");
        return;
      }
      try {
        const { signInWithPhoneNumber, RecaptchaVerifier } = await import("firebase/auth");
        const recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
        await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
        alert("OTP sent. After verification you will be signed in. Complete your profile next.");
        router.push("/auth/complete-profile");
      } catch (error: any) {
        alert(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

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
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, email, {
        url: `${location.origin}/auth`,
      });
      alert("Password reset email sent. Check your inbox.");
    } catch (error: any) {
      alert(error.message);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-[#030420] to-[#07061a] p-6 text-white">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("signin")}
            className={`flex-1 py-2 rounded-md ${tab === "signin" ? "bg-blue-600" : "bg-zinc-800"}`}
          >
            Sign in
          </button>
          <button
            onClick={() => setTab("signup")}
            className={`flex-1 py-2 rounded-md ${tab === "signup" ? "bg-emerald-600" : "bg-zinc-800"}`}
          >
            Sign up (Phone)
          </button>
        </div>

        {tab === "signin" ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <label className="block text-sm text-zinc-300">
              Email or Username
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-2 w-full rounded-md bg-zinc-800 border border-zinc-700 p-2"
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
                  className="w-full rounded-md bg-zinc-800 border border-zinc-700 p-2 pr-10"
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

            <p className="text-sm text-zinc-400">
              Not registered?{" "}
              <button onClick={() => setTab("signup")} className="text-emerald-400 underline">
                Create an account
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignupPhone} className="space-y-4">
            <label className="block text-sm text-zinc-300">
              Phone (with country code)
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2 w-full rounded-md bg-zinc-800 border border-zinc-700 p-2"
                placeholder="+911234567890"
                inputMode="tel"
              />
            </label>

            <div className="flex items-center justify-between">
              <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 rounded-md">
                {loading ? "Sending OTP…" : "Send OTP"}
              </button>

              <button type="button" onClick={() => setTab("signin")} className="text-sm text-zinc-400 underline">
                Sign in with email
              </button>
            </div>

            <p className="text-sm text-zinc-400">After verification you'll complete your profile.</p>
          </form>
        )}
      </div>
    </div>
  );
}
