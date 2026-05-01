"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase/config";
import { onAuthStateChanged, updateProfile, updateEmail, updatePassword, User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import ProfileImageUploader from "@/components/ProfileImageUploader";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/card";
import { Edit2, Eye, EyeOff, Save, X } from "lucide-react";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Load profile data from Firestore
        const profileRef = doc(db, "profiles", user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          setFullName(profileData.full_name || user.displayName || "");
          setUsername(profileData.username || "");
          setEmail(profileData.email || user.email || "");
          setPhone(profileData.phone || user.phoneNumber || "");
          setProfileImage(profileData.profile_image || user.photoURL || "");
        } else {
          // If no profile exists, use auth data
          setFullName(user.displayName || "");
          setEmail(user.email || "");
          setPhone(user.phoneNumber || "");
          setProfileImage(user.photoURL || "");
        }
      } else {
        router.push("/auth");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const edit = searchParams?.get("edit");
    if (edit === "1" || edit === "true") setIsEditing(true);
  }, [searchParams]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    // Validation: username unique
    if (username) {
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty && querySnapshot.docs[0].id !== user.uid) {
        alert("Username already taken.");
        setSaving(false);
        return;
      }
    }

    // Validation: email unique
    if (email) {
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty && querySnapshot.docs[0].id !== user.uid) {
        alert("Email already registered.");
        setSaving(false);
        return;
      }
    }

    // Update Firebase Auth profile if needed
    try {
      if (email && email !== user.email) {
        await updateEmail(user, email);
      }
      if (password) {
        await updatePassword(user, password);
      }
      if (fullName || profileImage) {
        await updateProfile(user, {
          displayName: fullName || user.displayName || undefined,
          photoURL: profileImage || user.photoURL || undefined,
        });
      }
    } catch (err: any) {
      alert(err.message);
      setSaving(false);
      return;
    }

    // Save profile to Firestore
    const profile = {
      full_name: fullName || null,
      username: username || null,
      email: email || user.email || null,
      phone: phone || null,
      profile_image: profileImage || null,
      updated_at: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, "profiles", user.uid), profile, { merge: true });
      setIsEditing(false);
      setPassword(""); // Clear password field after save
      alert("Profile updated successfully!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    // Reload original data
    if (user) {
      const profileRef = doc(db, "profiles", user.uid);
      getDoc(profileRef).then((profileSnap) => {
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          setFullName(profileData.full_name || user.displayName || "");
          setUsername(profileData.username || "");
          setEmail(profileData.email || user.email || "");
          setPhone(profileData.phone || user.phoneNumber || "");
          setProfileImage(profileData.profile_image || user.photoURL || "");
        } else {
          setFullName(user.displayName || "");
          setEmail(user.email || "");
          setPhone(user.phoneNumber || "");
          setProfileImage(user.photoURL || "");
        }
      });
    }
    setIsEditing(false);
    setPassword("");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2">
            <Edit2 size={16} />
            Edit
          </Button>
        )}
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white">Profile Information</CardTitle>
          <CardDescription className="text-zinc-400">
            Manage your account details and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {/* Profile Image */}
            <div className="space-y-2">
              <Label className="text-zinc-300">Profile Picture</Label>
              <div className="flex items-center gap-4">
                {profileImage && (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-zinc-700"
                  />
                )}
                {isEditing && (
                  <ProfileImageUploader
                    userId={user.uid}
                    onUpload={(url) => setProfileImage(url)}
                  />
                )}
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-zinc-300">
                Full Name
              </Label>
              {isEditing ? (
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Enter your full name"
                />
              ) : (
                <div className="text-white py-2 px-3 bg-zinc-800 rounded-md border border-zinc-700">
                  {fullName || "Not set"}
                </div>
              )}
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-300">
                Username
              </Label>
              {isEditing ? (
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Enter your username"
                />
              ) : (
                <div className="text-white py-2 px-3 bg-zinc-800 rounded-md border border-zinc-700">
                  {username || "Not set"}
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">
                Email
              </Label>
              {isEditing ? (
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Enter your email"
                />
              ) : (
                <div className="text-white py-2 px-3 bg-zinc-800 rounded-md border border-zinc-700">
                  {email || "Not set"}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-zinc-300">
                Phone
              </Label>
              {isEditing ? (
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white"
                  placeholder="Enter your phone number"
                />
              ) : (
                <div className="text-white py-2 px-3 bg-zinc-800 rounded-md border border-zinc-700">
                  {phone || "Not set"}
                </div>
              )}
            </div>

            {/* Password (only shown in edit mode) */}
            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300">
                  New Password (optional)
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white pr-10"
                    placeholder="Leave blank to keep current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex items-center gap-3 pt-4">
                <Button type="submit" disabled={saving} className="gap-2">
                  <Save size={16} />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                  className="gap-2"
                >
                  <X size={16} />
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
