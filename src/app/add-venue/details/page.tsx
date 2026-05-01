"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo, Suspense } from "react";
import { STATE_CITIES_MAP, STATES, REGION_MAP } from "@/components/FilterBar";
import { markStepComplete, STEPS, arePreviousStepsComplete, getFirstIncompleteStepUrl } from "@/lib/venue-steps";

interface VenueDetailsState {
  service: string;
  category: string;
  name: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  region: string;
  pincode: string;
  googlePin: string;
}

function Step2VenueDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if previous steps are completed
  useEffect(() => {
    if (!arePreviousStepsComplete(STEPS.DETAILS)) {
      // Redirect to the first incomplete step
      router.replace(getFirstIncompleteStepUrl());
    }
  }, [router]);

  const [formData, setFormData] = useState<VenueDetailsState>({
    service: "",
    category: "",
    name: "",
    address1: "",
    address2: "",
    country: "India",
    state: "",
    city: "",
    region: "",
    pincode: "",
    googlePin: "",
  });

  // Get cities for selected state
  const availableCities = useMemo(() => {
    if (!formData.state) return [];
    return STATE_CITIES_MAP[formData.state] || [];
  }, [formData.state]);

  // Get regions for selected city
  const availableRegions = useMemo(() => {
    if (!formData.city) return [];
    return REGION_MAP[formData.city] || [];
  }, [formData.city]);

  // Reset city when state changes
  useEffect(() => {
    if (formData.state && !availableCities.includes(formData.city)) {
      setFormData((prev) => ({
        ...prev,
        city: "",
        region: "", // Also reset region when city is reset
      }));
    }
  }, [formData.state, formData.city, availableCities]);

  // Reset region when city changes
  useEffect(() => {
    if (formData.city && !availableRegions.includes(formData.region)) {
      setFormData((prev) => ({
        ...prev,
        region: "",
      }));
    }
  }, [formData.city, formData.region, availableRegions]);

  // Pre-fill service and category from query params
  useEffect(() => {
    const service = searchParams?.get("service") || "";
    const category = searchParams?.get("category") || "";
    
    if (service || category) {
      setFormData((prev) => ({
        ...prev,
        service: service,
        category: category,
      }));
    }
  }, [searchParams]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const serviceLabel = useMemo(() => {
    if (!formData.service) return "Not set yet";
    const map: Record<string, string> = {
      venue: "Venue",
      decorator: "Decorator",
      caterer: "Caterer",
      dj: "DJ",
      photographer: "Photographer",
    };
    return map[formData.service] || formData.service;
  }, [formData.service]);

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.service) {
      newErrors.service = "Service type is required";
    }

    if (!formData.category) {
      newErrors.category = "Category is required";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Service name is required";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Service name must be at least 3 characters";
    }

    if (!formData.address1.trim()) {
      newErrors.address1 = "Address line 1 is required";
    }

    if (!formData.country.trim()) {
      newErrors.country = "Country is required";
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    if (!formData.pincode.trim()) {
      newErrors.pincode = "Pincode is required";
    } else if (!/^\d{5,6}$/.test(formData.pincode.trim())) {
      newErrors.pincode = "Pincode must be 5-6 digits";
    }

    if (formData.googlePin && !isValidUrl(formData.googlePin)) {
      newErrors.googlePin = "Please enter a valid URL";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.includes("maps.google.com") || url.includes("google.com/maps");
    } catch {
      return false;
    }
  }

  function handleInputChange(
    field: keyof VenueDetailsState,
    value: string
  ): void {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  }

  function handleNext(e: React.FormEvent): void {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const query = new URLSearchParams({
      service: formData.service,
      category: formData.category,
      name: formData.name.trim(),
      address1: formData.address1.trim(),
      address2: formData.address2.trim(),
      country: formData.country.trim(),
      state: formData.state.trim(),
      city: formData.city.trim(),
      region: formData.region.trim(),
      pincode: formData.pincode.trim(),
      googlePin: formData.googlePin.trim(),
    }).toString();

    // Mark step 2 as complete before navigating
    markStepComplete(STEPS.DETAILS);
    
    router.push(`/add-venue/description?${query}`);
    setIsSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
      <div className="w-full max-w-5xl bg-[#07102a]/80 border border-zinc-800 rounded-xl p-6 md:p-8 shadow-xl">
        <h2 className="text-3xl font-bold mb-2 text-center">Service Details</h2>
        <p className="text-center text-zinc-400 mb-6 md:mb-8">
          Fill in the details guests will see and filter by
        </p>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Main form */}
          <form onSubmit={handleNext} className="space-y-5">
          {/* Service */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Service Type <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.service}
              onChange={(e) => handleInputChange("service", e.target.value)}
              className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                errors.service
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-700 focus:border-zinc-600"
              } focus:outline-none`}
            >
              <option value="">Select a service</option>
              <option value="venue">Venue</option>
              <option value="decorator">Decorator</option>
              <option value="caterer">Caterer</option>
              <option value="dj">DJ</option>
              <option value="photographer">Photographer</option>
            </select>
            {errors.service && (
              <p className="text-xs text-red-400 mt-1">{errors.service}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Category <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => handleInputChange("category", e.target.value)}
              placeholder="e.g., Luxury, Budget, Premium"
              className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                errors.category
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-700 focus:border-zinc-600"
              } focus:outline-none`}
            />
            {errors.category && (
              <p className="text-xs text-red-400 mt-1">{errors.category}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Name of venue / service <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                errors.name
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-700 focus:border-zinc-600"
              } focus:outline-none`}
              placeholder="Ex: Club Alpha, Royal Decorators, Bombay Catering Co."
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              maxLength={100}
            />
            {errors.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Address 1 */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Address Line 1 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                errors.address1
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-700 focus:border-zinc-600"
              } focus:outline-none`}
              placeholder="Street / Building / Locality"
              value={formData.address1}
              onChange={(e) => handleInputChange("address1", e.target.value)}
              maxLength={100}
            />
            {errors.address1 && (
              <p className="text-xs text-red-400 mt-1">{errors.address1}</p>
            )}
          </div>

          {/* Address 2 */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Address Line 2 <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              type="text"
              className="w-full bg-zinc-900 rounded-md border border-zinc-700 p-3 focus:border-zinc-600 focus:outline-none transition"
              placeholder="Landmark / Area (optional)"
              value={formData.address2}
              onChange={(e) => handleInputChange("address2", e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Country <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                errors.country
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-700 focus:border-zinc-600"
              } focus:outline-none`}
              placeholder="India"
              value={formData.country}
              onChange={(e) => handleInputChange("country", e.target.value)}
              maxLength={50}
            />
            {errors.country && (
              <p className="text-xs text-red-400 mt-1">{errors.country}</p>
            )}
          </div>

          {/* State + City */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-zinc-300">
                State <span className="text-red-400">*</span>
              </label>
              <select
                className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                  errors.state
                    ? "border-red-500 focus:border-red-500"
                    : "border-zinc-700 focus:border-zinc-600"
                } focus:outline-none`}
                value={formData.state}
                onChange={(e) => {
                  handleInputChange("state", e.target.value);
                  handleInputChange("city", ""); // Reset city when state changes
                }}
              >
                <option value="">Select State</option>
                {STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              {errors.state && (
                <p className="text-xs text-red-400 mt-1">{errors.state}</p>
              )}
            </div>

            <div>
              <label className="block text-sm mb-2 text-zinc-300">
                City <span className="text-red-400">*</span>
              </label>
              <select
                className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                  errors.city
                    ? "border-red-500 focus:border-red-500"
                    : "border-zinc-700 focus:border-zinc-600"
                } focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
                value={formData.city}
                onChange={(e) => {
                  handleInputChange("city", e.target.value);
                  handleInputChange("region", ""); // Reset region when city changes
                }}
                disabled={!formData.state || availableCities.length === 0}
              >
                <option value="">
                  {formData.state
                    ? availableCities.length > 0
                      ? "Select City"
                      : "No cities available"
                    : "Select State first"}
                </option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              {errors.city && (
                <p className="text-xs text-red-400 mt-1">{errors.city}</p>
              )}
            </div>
          </div>

          {/* Region */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Region <span className="text-zinc-500">(optional)</span>
            </label>
            <select
              className="w-full bg-zinc-900 rounded-md border border-zinc-700 p-3 focus:border-zinc-600 focus:outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
              value={formData.region}
              onChange={(e) => handleInputChange("region", e.target.value)}
              disabled={!formData.city || availableRegions.length === 0}
            >
              <option value="">
                {formData.city
                  ? availableRegions.length > 0
                    ? "Select Region (optional)"
                    : "No regions available"
                  : "Select City first"}
              </option>
              {availableRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Pincode <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                errors.pincode
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-700 focus:border-zinc-600"
              } focus:outline-none`}
              placeholder="Ex: 400001"
              value={formData.pincode}
              onChange={(e) => handleInputChange("pincode", e.target.value)}
              maxLength={6}
            />
            {errors.pincode && (
              <p className="text-xs text-red-400 mt-1">{errors.pincode}</p>
            )}
          </div>

          {/* Google Pin */}
          <div>
            <label className="block text-sm mb-2 text-zinc-300">
              Google Maps Pin URL{" "}
              <span className="text-zinc-500">(optional)</span>
            </label>
            <input
              type="url"
              className={`w-full bg-zinc-900 rounded-md border p-3 transition ${
                errors.googlePin
                  ? "border-red-500 focus:border-red-500"
                  : "border-zinc-700 focus:border-zinc-600"
              } focus:outline-none`}
              placeholder="https://maps.google.com/..."
              value={formData.googlePin}
              onChange={(e) => handleInputChange("googlePin", e.target.value)}
            />
            {errors.googlePin && (
              <p className="text-xs text-red-400 mt-1">{errors.googlePin}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 disabled:opacity-50 rounded-md p-3 text-lg font-semibold transition"
            >
              {isSubmitting ? "Processing..." : "Next →"}
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 bg-zinc-700 hover:bg-zinc-600 rounded-md font-semibold transition"
            >
              Back
            </button>
          </div>
        </form>

        {/* Filters sidebar */}
        <aside className="rounded-xl border border-zinc-800 bg-[#050922]/80 p-4 md:p-5 text-sm space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Filters preview</h3>
            <p className="text-xs text-zinc-400">
              This is how guests will narrow down to services like yours on the search page.
            </p>
          </div>

          <dl className="space-y-3">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
                Service type
              </dt>
              <dd className="text-zinc-100">
                {serviceLabel}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
                Category / style
              </dt>
              <dd className="text-zinc-100">
                {formData.category || "Not set yet"}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
                State & city
              </dt>
              <dd className="text-zinc-100">
                {formData.state || formData.city
                  ? `${formData.city || "City not set"}, ${formData.state || "State not set"}`
                  : "Not set yet"}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
                Region (micro‑location)
              </dt>
              <dd className="text-zinc-100">
                {formData.region || "Optional – helps guests find you faster"}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">
                Google Maps pin
              </dt>
              <dd className="text-zinc-100">
                {formData.googlePin
                  ? "Added – we’ll show a map preview on your listing"
                  : "Add a maps link so guests can see the exact location"}
              </dd>
            </div>
          </dl>

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            You&apos;ll set pricing, amenities and photos in the next steps.
            Those become additional filters like budget, capacity and facilities on the search page.
          </p>
        </aside>
        </div>
      </div>
    </div>
  );
}

export default function Step2VenueDetails() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
        <div className="w-full max-w-2xl bg-[#07102a]/80 border border-zinc-800 rounded-xl p-8 shadow-xl">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    }>
      <Step2VenueDetailsContent />
    </Suspense>
  );
}