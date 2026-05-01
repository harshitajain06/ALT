// src/app/auth/signup/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/config";
import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
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
        // User is not signed in, allow them to see the signup page
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // SIGN UP via EMAIL (verification required)
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (!email || !password) {
        alert("Provide email and password to sign up.");
        return;
      }

      try {
        await createUserWithEmailAndPassword(auth, email, password);
        // Firebase automatically sends verification email
        alert("Verification email sent. Check your inbox. After verifying, you'll be redirected to complete your profile.");
        // After email verification, user will be redirected to /auth/complete-profile
      } catch (error: any) {
        alert(error.message);
        return;
      }
    } finally {
      setLoading(false);
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
        <h1 className="text-2xl font-bold mb-6 text-center">Sign up</h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <label className="block text-sm text-zinc-300">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-md bg-zinc-900 border border-zinc-700 p-2"
              placeholder="you@example.com"
              autoComplete="email"
              type="email"
              required
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
                placeholder="Create a password"
                autoComplete="new-password"
                required
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
            <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 rounded-md hover:bg-emerald-700">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </div>

          <p className="text-sm text-zinc-400">We will send a verification email. Click it to continue account setup.</p>
        </form>

        <p className="text-sm text-zinc-400 mt-6 text-center">
          Already have an account?{" "}
          <button onClick={() => router.push("/auth")} className="text-blue-400 underline hover:text-blue-300">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
