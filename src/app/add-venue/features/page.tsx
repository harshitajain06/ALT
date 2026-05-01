"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { markStepComplete, STEPS, arePreviousStepsComplete, getFirstIncompleteStepUrl } from "@/lib/venue-steps";
import { Minus, Plus } from "lucide-react";

const SERVICE_FEATURES: Record<string, string[]> = {
  venue: [
    "Bedrooms",
    "Bathrooms",
    "Kitchen",
    "Swimming Pool",
    "Gym",
    "Terrace",
    "Balcony",
    "Wi-Fi Router",
    "Smart TV",
    "Washing Machine",
    "Backup Generator",
    "Outdoor Seating",
    "Parking Spots",
    "Event Hall",
    "DJ Console",
  ],
  decorator: [
    "Floral Arrangements",
    "Lighting Setup",
    "Backdrop Design",
    "Table Settings",
    "Stage Decoration",
    "Ceiling Décor",
    "Entrance Décor",
    "Photobooth Setup",
    "Custom Props",
    "Color Theme Design",
    "Outdoor Decoration",
    "Indoor Decoration",
    "Marquee Setup",
    "Carpet/Flooring",
    "Sound System Integration",
  ],
  caterer: [
    "Vegetarian Menu",
    "Non-Vegetarian Menu",
    "Vegan Options",
    "Live Counters",
    "Dessert Stations",
    "Beverage Service",
    "Wait Staff",
    "Table Service",
    "Buffet Setup",
    "Plated Service",
    "Custom Menu Design",
    "Dietary Restrictions",
    "Equipment Provided",
    "Cleanup Service",
    "Chef on Site",
  ],
  dj: [
    "Sound System",
    "Microphone",
    "LED Lighting",
    "Fog Machine",
    "Projection Screen",
    "Karaoke Setup",
    "Music Library",
    "Live Mixing",
    "MC Services",
    "Wireless Setup",
    "Subwoofers",
    "Backup Equipment",
    "Extended Hours",
    "Multiple Genres",
    "Custom Playlist",
  ],
  photographer: [
    "Pre-Wedding Shoot",
    "Wedding Coverage",
    "Candid Photography",
    "Video Coverage",
    "Drone Photography",
    "Photo Editing",
    "Video Editing",
    "Album Design",
    "Online Gallery",
    "USB Delivery",
    "Multiple Photographers",
    "Extended Hours",
    "Raw Files",
    "Same Day Preview",
    "Wedding Highlights",
  ],
};

const SERVICE_NAMES: Record<string, string> = {
  venue: "Venue",
  decorator: "Decorator",
  caterer: "Caterer",
  dj: "DJ",
  photographer: "Photographer",
};

function VenueFeaturesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [otherName, setOtherName] = useState("");
  const [otherQty, setOtherQty] = useState(1);

  const service = searchParams?.get("service") || "venue";
  const serviceName = SERVICE_NAMES[service] || "Service";
  const allFeatures = SERVICE_FEATURES[service] || SERVICE_FEATURES.venue;

  // Check if previous steps are completed
  useEffect(() => {
    if (!arePreviousStepsComplete(STEPS.FEATURES)) {
      // Redirect to the first incomplete step
      router.replace(getFirstIncompleteStepUrl());
    }
  }, [router]);

  const normalizedSearch = search.trim().toLowerCase();
  const customSelectedKeys = Object.keys(selected).filter(
    (k) => !allFeatures.includes(k)
  );

  const displayFeatures = [
    ...allFeatures,
    ...customSelectedKeys, // keep custom features visible & editable
  ].filter((item, idx, arr) => arr.indexOf(item) === idx);

  const filtered = normalizedSearch
    ? displayFeatures.filter((item) =>
        item.toLowerCase().includes(normalizedSearch)
      )
    : displayFeatures;

  const increment = (feature: string) => {
    setSelected((prev) => ({ ...prev, [feature]: (prev[feature] ?? 0) + 1 }));
  };

  const decrement = (feature: string) => {
    setSelected((prev) => {
      const current = prev[feature] ?? 0;
      if (current <= 1) {
        const { [feature]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [feature]: current - 1 };
    });
  };

  const addOther = () => {
    const name = otherName.trim();
    if (!name) {
      alert("Enter a feature name.");
      return;
    }
    if (!Number.isFinite(otherQty) || otherQty < 1) {
      alert("Enter a valid quantity (min 1).");
      return;
    }
    increment(name);
    // If user typed a qty > 1, set it exactly once (so it doesn't double-add)
    if (otherQty > 1) {
      setSelected((prev) => ({ ...prev, [name]: otherQty }));
    }
    setOtherName("");
    setOtherQty(1);
  };

  const handleNext = () => {
    if (Object.keys(selected).length === 0) {
      alert("Select at least one feature.");
      return;
    }
    localStorage.setItem("venue_features", JSON.stringify(selected));
    
    // Mark step 4 as complete before navigating
    markStepComplete(STEPS.FEATURES);
    
    // Preserve service type, category, and name in the URL
    const category = searchParams?.get("category") || "";
    const name = searchParams?.get("name") || "";
    const query = new URLSearchParams({
      service,
      ...(category && { category }),
      ...(name && { name }),
    }).toString();
    router.push(`/add-venue/gallery?${query}`);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white p-6">
      <div className="max-w-3xl mx-auto bg-[#07102a]/80 border border-zinc-800 rounded-xl p-6 shadow-lg">
        <h1 className="text-2xl font-semibold mb-4 text-center">{serviceName} Features</h1>
        <p className="text-sm text-zinc-400 mb-4 text-center">
          Use <span className="text-zinc-200 font-medium">+</span> and{" "}
          <span className="text-zinc-200 font-medium">−</span> to adjust quantities.
        </p>

        <input
          className="w-full rounded-md bg-zinc-900 border border-zinc-800 p-3 mb-4"
          placeholder="Search features..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Other feature */}
        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-sm font-medium text-zinc-200 mb-3">Other</div>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px_110px] gap-2 items-end">
            <label className="block text-xs text-zinc-400">
              Feature name
              <input
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                className="mt-1 w-full rounded-md bg-zinc-950/40 border border-zinc-800 p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                placeholder="e.g., Projector, Valet, AC units..."
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Qty
              <input
                value={String(otherQty)}
                onChange={(e) => setOtherQty(Number(e.target.value))}
                type="number"
                min={1}
                className="mt-1 w-full rounded-md bg-zinc-950/40 border border-zinc-800 p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </label>
            <button
              type="button"
              onClick={addOther}
              className="h-9 rounded-md bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold transition"
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {filtered.map((item) => {
            const qty = selected[item] ?? 0;
            return (
              <div
                key={item}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition ${
                  qty > 0
                    ? "border-emerald-600/50 bg-emerald-600/10"
                    : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {item}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {qty > 0 ? `${qty} selected` : "Not selected"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => decrement(item)}
                    disabled={qty === 0}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    aria-label={`Decrease ${item}`}
                  >
                    <Minus size={16} />
                  </button>
                  <div className="w-10 text-center text-sm font-semibold text-zinc-100 tabular-nums">
                    {qty}
                  </div>
                  <button
                    type="button"
                    onClick={() => increment(item)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/40 hover:bg-zinc-900 transition"
                    aria-label={`Increase ${item}`}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleNext}
          className="w-full mt-4 py-3 bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function VenueFeaturesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white p-6">
        <div className="max-w-3xl mx-auto bg-[#07102a]/80 border border-zinc-800 rounded-xl p-6 shadow-lg">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    }>
      <VenueFeaturesContent />
    </Suspense>
  );
}
