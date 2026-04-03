"use client";

import { useState, useEffect, Suspense } from "react";
import { storage, db, auth } from "@/lib/firebase/config";
import { useRouter, useSearchParams } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { markStepComplete, STEPS, arePreviousStepsComplete, getFirstIncompleteStepUrl } from "@/lib/venue-steps";
import { formatFirebaseStorageError } from "@/lib/firebase/storageErrors";

interface GalleryItem {
  tempUrl: string;
  file: File;
  caption: string;
}

const SERVICE_NAMES: Record<string, string> = {
  venue: "Venue",
  decorator: "Decorator",
  caterer: "Caterer",
  dj: "DJ",
  photographer: "Photographer",
};

const SERVICE_GALLERY_INFO: Record<string, { 
  description: string; 
  placeholder: string;
  minImages: number;
}> = {
  venue: {
    description: "Upload at least 1 image showcasing your venue's spaces, amenities, and atmosphere. Each image requires a caption.",
    placeholder: "Describe this venue space...",
    minImages: 1,
  },
  decorator: {
    description: "Upload at least 1 image of your decoration work, themes, and setups. Each image requires a caption.",
    placeholder: "Describe this decoration design...",
    minImages: 1,
  },
  caterer: {
    description: "Upload at least 1 image of your food presentations, setups, and menu items. Each image requires a caption.",
    placeholder: "Describe this dish/presentation...",
    minImages: 1,
  },
  dj: {
    description: "Upload at least 1 image of your DJ setup, events, equipment, and performance. Each image requires a caption.",
    placeholder: "Describe this DJ setup/event...",
    minImages: 1,
  },
  photographer: {
    description: "Upload at least 1 image showcasing your photography work, style, and portfolio. Each image requires a caption.",
    placeholder: "Describe this photography work...",
    minImages: 1,
  },
};

function VenueGalleryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const service = searchParams?.get("service") || "venue";
  const serviceName = SERVICE_NAMES[service] || "Service";
  const galleryInfo = SERVICE_GALLERY_INFO[service] || SERVICE_GALLERY_INFO.venue;

  useEffect(() => {
    // Check if previous steps are completed
    if (!arePreviousStepsComplete(STEPS.GALLERY)) {
      // Redirect to the first incomplete step
      router.replace(getFirstIncompleteStepUrl());
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return () => unsubscribe();
  }, [router]);

  function addItem(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: GalleryItem[] = [];
    
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Please upload images only.");
        e.target.value = ""; // Reset input
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be under 10MB.");
        e.target.value = ""; // Reset input
        return;
      }

      validFiles.push({
        tempUrl: URL.createObjectURL(file),
        file,
        caption: "",
      });
    }

    setItems((prev) => [...prev, ...validFiles]);
    setError(null);
    e.target.value = ""; // Reset input for next selection
  }

  function updateCaption(index: number, text: string) {
    const copy = [...items];
    copy[index].caption = text;
    setItems(copy);
  }

  function removeItem(index: number) {
    const copy = [...items];
    URL.revokeObjectURL(copy[index].tempUrl);
    copy.splice(index, 1);
    setItems(copy);
  }

  async function uploadToStorage(file: File, serviceType: string): Promise<string> {
    const ext = file.name.split(".").pop();
    const serviceFolder = `${serviceType}-gallery`;
    const filename = `${serviceFolder}/gallery-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, file, {
      contentType: file.type || "application/octet-stream",
    });
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  }

  async function submitGallery() {
    try {
      setError(null);

      if (items.length < galleryInfo.minImages) {
        setError(`Please upload at least ${galleryInfo.minImages} images.`);
        return;
      }

      if (items.some((i) => !i.caption.trim())) {
        setError("Every image must have a caption.");
        return;
      }

      setUploading(true);

      if (!userId) {
        setError("You must be logged in to upload images.");
        setUploading(false);
        return;
      }

      const category = searchParams?.get("category") || "";
      
      for (let item of items) {
        const publicUrl = await uploadToStorage(item.file, service);

        await addDoc(collection(db, "venue_gallery"), {
          url: publicUrl,
          caption: item.caption.trim(),
          user_id: userId,
          service_type: service,
          category: category, // Save category to filter images by category
          created_at: new Date().toISOString(),
        });
      }

      setUploading(false);
      
      // Mark step 5 as complete before navigating
      markStepComplete(STEPS.GALLERY);
      
      // Preserve service type, category, and name in the URL
      const name = searchParams?.get("name") || "";
      const query = new URLSearchParams({
        ...(service && { service }),
        ...(category && { category }),
        ...(name && { name }),
      }).toString();
      router.push(`/add-venue/step-6-booking?${query}`);
    } catch (err) {
      setUploading(false);
      setError(formatFirebaseStorageError(err));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
      <div className="max-w-3xl w-full bg-[#07102a]/90 p-8 rounded-xl border border-zinc-800 shadow-xl">
        <h1 className="text-3xl font-bold mb-4">{serviceName} Gallery</h1>
        <p className="text-zinc-400 mb-4">
          {galleryInfo.description}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded text-red-300">
            {error}
          </div>
        )}

        <div className="mb-4">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={addItem}
            disabled={uploading}
            className="mb-2 block"
          />
          <p className="text-xs text-zinc-500">
            {items.length === 0
              ? `Upload at least ${galleryInfo.minImages} image. You can add multiple images.`
              : `${items.length} image${items.length === 1 ? '' : 's'} uploaded. You can add more if needed.`}
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-4 mb-6">
          {items.map((it, i) => (
            <div key={i} className="bg-zinc-900 p-3 rounded-md">
              <img
                src={it.tempUrl}
                className="w-full h-44 object-cover rounded-md mb-2"
              />

              <input
                type="text"
                value={it.caption}
                onChange={(e) => updateCaption(i, e.target.value)}
                placeholder={galleryInfo.placeholder}
                className="w-full bg-zinc-800 border border-zinc-700 p-2 rounded"
              />

              <button
                onClick={() => removeItem(i)}
                className="text-red-400 mt-2 text-sm hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={submitGallery}
          disabled={uploading}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-bold"
        >
          {uploading ? "Uploading..." : "Next"}
        </button>
      </div>
    </div>
  );
}

export default function VenueGalleryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
        <div className="max-w-3xl w-full bg-[#07102a]/90 p-8 rounded-xl border border-zinc-800 shadow-xl">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    }>
      <VenueGalleryContent />
    </Suspense>
  );
}