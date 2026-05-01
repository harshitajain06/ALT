"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, addDays, eachDayOfInterval, parseISO } from "date-fns";
import { markStepComplete, STEPS, arePreviousStepsComplete, getFirstIncompleteStepUrl } from "@/lib/venue-steps";
import { CalendarDays } from "lucide-react";

// Utility - format date as YYYY-MM-DD using local time (not UTC)
function dateToISO(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

interface BookingState {
  service: string;
  startDate: string;
  endDate: string;
  excludeMode: boolean;
  excludedDates: string[];
  unit: string;
  pricePerUnit: number;
  priceSlider: number;
  discounts: { min_units: number; percent: number }[];
  discUnits: number;
  discPercent: number;
  error: string | null;
}

function Step6BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date();

  const [state, setState] = useState<BookingState>({
    service: "venue",
    startDate: dateToISO(today),
    endDate: dateToISO(addDays(today, 1)),
    excludeMode: false,
    excludedDates: [],
    unit: "night",
    pricePerUnit: 5000,
    priceSlider: 5000,
    discounts: [],
    discUnits: 3,
    discPercent: 5,
    error: null,
  });

  // Check if previous steps are completed
  useEffect(() => {
    if (!arePreviousStepsComplete(STEPS.BOOKING)) {
      // Redirect to the first incomplete step
      router.replace(getFirstIncompleteStepUrl());
      return;
    }
  }, [router]);

  // Load service type from URL params
  useEffect(() => {
    const service = searchParams?.get("service") || "venue";
    const category = searchParams?.get("category") || "";
    
    setState((prev) => ({
      ...prev,
      service,
    }));
  }, [searchParams]);

  const dateRangeDays = useMemo(() => {
    const s = parseISO(state.startDate);
    const e = parseISO(state.endDate);
    if (s > e) return [];

    return eachDayOfInterval({ start: s, end: e }).map((d) => dateToISO(d));
  }, [state.startDate, state.endDate]);

  const effectiveUnits = Math.max(
    0,
    dateRangeDays.length - state.excludedDates.length
  );

  function updateState<K extends keyof BookingState>(
    field: K,
    value: BookingState[K]
  ) {
    setState((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function toggleExcluded(dateISO: string) {
    setState((prev) => ({
      ...prev,
      excludedDates: prev.excludedDates.includes(dateISO)
        ? prev.excludedDates.filter((d) => d !== dateISO)
        : [...prev.excludedDates, dateISO],
    }));
  }

  function addDiscount() {
    if (
      state.discUnits <= 0 ||
      state.discPercent <= 0 ||
      state.discPercent > 100
    ) {
      setState((prev) => ({
        ...prev,
        error: "Please enter valid discount values (min units > 0, percent 1-100)",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      discounts: [
        ...prev.discounts,
        { min_units: prev.discUnits, percent: prev.discPercent },
      ],
      discUnits: 3,
      discPercent: 5,
      error: null,
    }));
  }

  function removeDiscount(index: number) {
    setState((prev) => ({
      ...prev,
      discounts: prev.discounts.filter((_, i) => i !== index),
    }));
  }

  function computeDiscount(subtotal: number) {
    const applicable = state.discounts.filter(
      (d) => effectiveUnits >= d.min_units
    );
    if (applicable.length === 0) return 0;
    const top = Math.max(...applicable.map((d) => d.percent));
    return +((subtotal * top) / 100).toFixed(2);
  }

  function handleNext() {
    let error = "";

    if (!state.startDate || !state.endDate) {
      error = "Please choose start and end dates.";
    } else if (new Date(state.startDate) > new Date(state.endDate)) {
      error = "Start date must be before end date.";
    } else if (state.pricePerUnit <= 0) {
      error = "Price per unit must be greater than 0.";
    }

    if (error) {
      setState((prev) => ({
        ...prev,
        error,
      }));
      return;
    }

    const category = searchParams?.get("category") || "";
    const name = searchParams?.get("name") || "";
    const query = new URLSearchParams({
      service: state.service,
      unit: state.unit,
      pricePerUnit: String(state.pricePerUnit),
      startDate: state.startDate,
      endDate: state.endDate,
      excludedDates: state.excludedDates.join(","),
      discounts: JSON.stringify(state.discounts),
      ...(category && { category }),
      ...(name && { name }),
    }).toString();

    // Mark step 6 as complete before navigating
    markStepComplete(STEPS.BOOKING);
    
    router.push(`/add-venue/step-8-summary?${query}`);
  }

  const subtotal = effectiveUnits * state.pricePerUnit;
  const discountAmount = computeDiscount(subtotal);
  const afterDiscount = subtotal - discountAmount;
  const commission = +(afterDiscount * 0.05).toFixed(2);
  const serviceFee = +((afterDiscount + commission) * 0.01).toFixed(2);
  const total = +(afterDiscount + commission + serviceFee).toFixed(2);

  return (
    <div className="min-h-screen p-6 bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white">
      <div className="max-w-4xl mx-auto bg-[#07102a]/80 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-2xl font-bold mb-4">Booking & Availability</h2>

        {state.error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200">
            {state.error}
          </div>
        )}

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <label className="block">
            <div className="text-sm text-zinc-300">Start date</div>
            <div className="relative mt-2">
              <input
                type="date"
                value={state.startDate}
                onChange={(e) => updateState("startDate", e.target.value)}
                className="w-full p-4 bg-zinc-900/90 rounded-xl border-2 border-zinc-700 hover:border-blue-500/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all text-white cursor-pointer shadow-sm hover:shadow-md"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <CalendarDays className="w-5 h-5 text-zinc-400" />
              </div>
            </div>
          </label>

          <label className="block">
            <div className="text-sm text-zinc-300">End date</div>
            <div className="relative mt-2">
              <input
                type="date"
                value={state.endDate}
                onChange={(e) => updateState("endDate", e.target.value)}
                className="w-full p-4 bg-zinc-900/90 rounded-xl border-2 border-zinc-700 hover:border-blue-500/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all text-white cursor-pointer shadow-sm hover:shadow-md"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <CalendarDays className="w-5 h-5 text-zinc-400" />
              </div>
            </div>
          </label>
        </div>

        {/* Exclusion */}
        <div className="mb-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={state.excludeMode}
              onChange={(e) => updateState("excludeMode", e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-sm text-zinc-300">
              Exclude specific dates
            </span>
          </label>
        </div>

        {/* Calendar preview */}
        {dateRangeDays.length > 0 && (
          <div className="mb-6">
            <div className="text-sm text-zinc-300 mb-2">
              Selected dates ({dateRangeDays.length} total,{" "}
              {state.excludedDates.length} excluded)
            </div>
            <div className="flex flex-wrap gap-2">
              {dateRangeDays.map((d) => (
                <button
                  key={d}
                  disabled={!state.excludeMode}
                  onClick={() => toggleExcluded(d)}
                  className={`px-3 py-1 rounded-md text-sm transition ${
                    state.excludedDates.includes(d)
                      ? "bg-red-600/80 hover:bg-red-700"
                      : "bg-blue-600/80 hover:bg-blue-700"
                  } ${
                    !state.excludeMode ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {format(parseISO(d), "dd MMM")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-zinc-300">Unit</label>
            <select
              value={state.unit}
              onChange={(e) => updateState("unit", e.target.value)}
              className="mt-2 p-2 rounded bg-zinc-900 w-full border border-zinc-700 focus:border-zinc-600 focus:outline-none transition"
            >
              <option value="night">Per night</option>
              <option value="hour">Per hour</option>
              <option value="gig">Per gig</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-zinc-300">
              Price per {state.unit}
            </label>
            <input
              type="number"
              min={0}
              value={state.pricePerUnit}
              onChange={(e) => {
                const val = Number(e.target.value);
                setState((prev) => ({
                  ...prev,
                  pricePerUnit: val,
                  priceSlider: val,
                }));
              }}
              className="mt-2 p-2 rounded bg-zinc-900 w-full border border-zinc-700 focus:border-zinc-600 focus:outline-none transition"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-300">Adjust price</label>
            <input
              type="range"
              min={0}
              max={200000}
              value={state.priceSlider}
              onChange={(e) => {
                const val = Number(e.target.value);
                setState((prev) => ({
                  ...prev,
                  priceSlider: val,
                  pricePerUnit: val,
                }));
              }}
              className="mt-3 w-full"
            />
            <div className="text-xs text-zinc-400 mt-1">
              ₹{state.pricePerUnit.toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        {/* Discounts */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Discounts</h3>
          <div className="flex gap-2 items-end mb-4 flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-zinc-300">Min units</label>
              <input
                type="number"
                min={1}
                value={state.discUnits}
                onChange={(e) => updateState("discUnits", Number(e.target.value))}
                className="mt-1 p-2 rounded bg-zinc-900 w-full border border-zinc-700 focus:border-zinc-600 focus:outline-none transition"
              />
            </div>

            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-zinc-300">Discount %</label>
              <input
                type="number"
                min={1}
                max={100}
                value={state.discPercent}
                onChange={(e) =>
                  updateState("discPercent", Number(e.target.value))
                }
                className="mt-1 p-2 rounded bg-zinc-900 w-full border border-zinc-700 focus:border-zinc-600 focus:outline-none transition"
              />
            </div>

            <button
              onClick={addDiscount}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition"
            >
              Add
            </button>
          </div>

          {state.discounts.length > 0 && (
            <div className="bg-zinc-900 p-3 rounded overflow-x-auto border border-zinc-700">
              <table className="w-full text-sm">
                <thead className="text-zinc-400 border-b border-zinc-700">
                  <tr>
                    <th className="text-left py-2">Min units</th>
                    <th className="text-left py-2">Discount %</th>
                    <th className="text-left py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {state.discounts.map((d, i) => (
                    <tr key={i} className="border-b border-zinc-800">
                      <td className="py-2">{d.min_units}</td>
                      <td className="py-2">{d.percent}%</td>
                      <td className="py-2">
                        <button
                          onClick={() => removeDiscount(i)}
                          className="text-xs text-red-400 hover:text-red-300 transition"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="mb-6 bg-[#021028] p-4 rounded border border-zinc-700">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <div className="text-zinc-400">
                Units ({dateRangeDays.length} days -{" "}
                {state.excludedDates.length} excluded)
              </div>
              <div className="font-semibold">{effectiveUnits}</div>
            </div>
            <div className="flex justify-between">
              <div className="text-zinc-400">Subtotal</div>
              <div>
                ₹{subtotal.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-400">
                <div>Discount</div>
                <div>
                  - ₹{discountAmount.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <div className="text-zinc-400">Commission (5%)</div>
              <div>
                ₹{commission.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="flex justify-between">
              <div className="text-zinc-400">Service fee (1%)</div>
              <div>
                ₹{serviceFee.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            <div className="flex justify-between text-lg font-bold pt-2 border-t border-zinc-600">
              <div>Total</div>
              <div className="text-blue-400">
                ₹{total.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition"
            onClick={handleNext}
          >
            Next: Summary
          </button>

          <button
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md transition"
            onClick={() => router.back()}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Step6Booking() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-6 bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white">
        <div className="max-w-4xl mx-auto bg-[#07102a]/80 p-6 rounded-xl border border-zinc-800">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    }>
      <Step6BookingContent />
    </Suspense>
  );
}