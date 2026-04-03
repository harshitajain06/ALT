// src/app/search/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { db, auth } from "@/lib/firebase/config";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import FilterBar from "@/components/FilterBar";

interface Listing {
  id: string;
  service_type: string;
  category: string;
  name: string;
  description: string;
  address: {
    city: string;
    state: string;
    country: string;
  };
  images: string[];
  price_per_unit: number;
  unit: string;
  features?: Record<string, number>;
  average_rating?: number;
  review_count?: number;
  bookingsCount?: number;
  availability_start_date?: string | null;
  availability_end_date?: string | null;
  excluded_dates?: string[];
}

export default function SearchPage() {
  // filter states
  const [category, setCategory] = useState("Venue");
  const [subtype, setSubtype] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");

  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");

  const [stars, setStars] = useState(0);
  const [bookingsMin, setBookingsMin] = useState(0);
  const [priceMax, setPriceMax] = useState(200000);
  const [amenities, setAmenities] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch listings from Firestore
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function fetchListings() {
      try {
        const listingsRef = collection(db, "listings");
        let listingsQuery;
        try {
          listingsQuery = query(listingsRef, orderBy("created_at", "desc"));
        } catch (error) {
          console.warn("OrderBy failed, fetching without order:", error);
          listingsQuery = query(listingsRef);
        }

        const listingsSnap = await getDocs(listingsQuery);
        const listingsData: Listing[] = [];

        listingsSnap.docs.forEach((doc) => {
          const data = doc.data();
          // Only include approved listings (or listings without approval field for backward compatibility)
          if (data.approved === false) {
            return; // Skip unapproved listings
          }
          listingsData.push({
            id: doc.id,
            service_type: data.service_type || "",
            category: data.category || "",
            name: data.name || "",
            description: data.description || "",
            address: data.address || { city: "", state: "", country: "" },
            images: data.images || [],
            price_per_unit: data.price_per_unit || 0,
            unit: data.unit || "night",
            features: data.features || {},
            average_rating: data.average_rating || 0,
            review_count: data.review_count || 0,
            bookingsCount: data.bookingsCount || 0,
            availability_start_date: data.availability_start_date || null,
            availability_end_date: data.availability_end_date || null,
            excluded_dates: data.excluded_dates || [],
          });
        });

        setListings(listingsData);
        setLoading(false);
      } catch (error: any) {
        console.error("Error fetching listings:", error);
        // Check if it's a permissions error
        if (error?.code === "permission-denied" || error?.message?.includes("permissions")) {
          console.error("Firestore permission error. Please check your Firestore security rules to allow public read access to the 'listings' collection.");
        }
        setLoading(false);
      }
    }

    // Wait for auth state to initialize before fetching
    // This ensures Firebase is fully initialized
    unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Fetch listings regardless of auth state (public pages should work for everyone)
      await fetchListings();
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // ------- FILTER SEARCH RESULTS -------
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      // Filter by service type (category)
      if (category) {
        // Map filter category names to database service_type values
        const serviceTypeMap: Record<string, string> = {
          "Venue": "venue",
          "Decorator": "decorator",
          "Caterer": "caterer",
          "DJ": "dj",
          "Photographer": "photographer",
        };
        const mappedType = serviceTypeMap[category] || category.toLowerCase();
        if (l.service_type.toLowerCase() !== mappedType) return false;
      }

      // Filter by subtype/category
      if (subtype && l.category.toLowerCase() !== subtype.toLowerCase()) return false;

      // Filter by state
      if (state && l.address.state.toLowerCase() !== state.toLowerCase()) return false;

      // Filter by city
      if (city && !l.address.city.toLowerCase().includes(city.toLowerCase())) return false;

      // Filter by region
      if (region && l.address.state.toLowerCase() !== region.toLowerCase()) return false;

      // Filter by price
      if (priceMax && l.price_per_unit > priceMax) return false;

      // Filter by minimum stars/rating (if listing has average_rating field)
      if (stars > 0) {
        const listingRating = l.average_rating || 0;
        if (listingRating < stars) return false;
      }

      // Filter by minimum bookings (if listing has review_count or bookingsCount field)
      if (bookingsMin > 0) {
        const listingBookings = l.review_count || l.bookingsCount || 0;
        if (listingBookings < bookingsMin) return false;
      }

      // Filter by amenities/features
      if (amenities.length > 0) {
        const featureKeys = Object.keys(l.features || {});
        for (const am of amenities) {
          if (!featureKeys.some(key => key.toLowerCase().includes(am.toLowerCase()))) {
            return false;
          }
        }
      }

      // Filter by search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !l.name.toLowerCase().includes(q) &&
          !l.description.toLowerCase().includes(q) &&
          !l.address.city.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      // Filter by date availability
      if (startDateStr || endDateStr) {
        // If listing has availability dates set, check if requested dates are available
        if (l.availability_start_date && l.availability_end_date) {
          const listingStart = new Date(l.availability_start_date);
          const listingEnd = new Date(l.availability_end_date);
          
          // If user specified start date, check if it's within listing availability
          if (startDateStr) {
            const requestedStart = new Date(startDateStr);
            if (requestedStart < listingStart || requestedStart > listingEnd) {
              return false;
            }
          }
          
          // If user specified end date, check if it's within listing availability
          if (endDateStr) {
            const requestedEnd = new Date(endDateStr);
            if (requestedEnd < listingStart || requestedEnd > listingEnd) {
              return false;
            }
          }
          
          // If both dates specified, check if the range overlaps with listing availability
          if (startDateStr && endDateStr) {
            const requestedStart = new Date(startDateStr);
            const requestedEnd = new Date(endDateStr);
            
            // Check if requested range overlaps with listing availability
            if (requestedStart > listingEnd || requestedEnd < listingStart) {
              return false;
            }
            
            // Check if any requested dates are in excluded_dates
            if (l.excluded_dates && l.excluded_dates.length > 0) {
              const requestedDates: string[] = [];
              const start = new Date(requestedStart);
              const end = new Date(requestedEnd);
              
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                requestedDates.push(d.toISOString().slice(0, 10));
              }
              
              // If any requested date is excluded, filter out the listing
              const hasExcludedDate = requestedDates.some(date => 
                l.excluded_dates?.includes(date)
              );
              if (hasExcludedDate) {
                return false;
              }
            }
          }
        }
        // If listing doesn't have availability dates set, include it (backward compatibility)
      }

      return true;
    });
  }, [
    listings,
    category,
    subtype,
    state,
    city,
    region,
    stars,
    bookingsMin,
    priceMax,
    amenities,
    searchQuery,
    startDateStr,
    endDateStr,
  ]);

  // ------- RESET HANDLER -------
  function resetAll() {
    setCategory("Venue");
    setSubtype("");
    setState("");
    setCity("");
    setRegion("");
    setStartDateStr("");
    setEndDateStr("");
    setStars(0);
    setBookingsMin(0);
    setPriceMax(200000);
    setAmenities([]);
    setSearchQuery("");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* ⭐ FILTER BAR */}
        <FilterBar
          category={category}
          setCategory={setCategory}
          subtype={subtype}
          setSubtype={setSubtype}
          state={state}
          setState={setState}
          city={city}
          setCity={setCity}
          region={region}
          setRegion={setRegion}
          startDateStr={startDateStr}
          setStartDateStr={setStartDateStr}
          endDateStr={endDateStr}
          setEndDateStr={setEndDateStr}
          stars={stars}
          setStars={setStars}
          bookingsMin={bookingsMin}
          setBookingsMin={setBookingsMin}
          priceMax={priceMax}
          setPriceMax={setPriceMax}
          amenities={amenities}
          setAmenities={setAmenities}
          onReset={resetAll}
        />

        {/* RESULTS COUNT */}
        {loading ? (
          <div className="mb-4 text-zinc-300">Loading listings...</div>
        ) : (
          <div className="mb-4 text-zinc-300">{filteredListings.length} results</div>
        )}

        {/* LISTINGS GRID */}
        {loading ? (
          <div className="text-center py-12 text-zinc-400">Loading...</div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            No listings found. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((l) => (
              <div
                key={l.id}
                className="group bg-[#07162f]/60 rounded-xl overflow-hidden border border-zinc-800 hover:scale-[1.01] transition"
              >
                <Link href={`/search/${l.id}`}>
                  <div className="relative h-44">
                    <img
                      src={l.images && l.images.length > 0 ? l.images[0] : "/placeholder.svg"}
                      alt={l.name}
                      className="w-full h-full object-cover brightness-90 group-hover:brightness-110 transition"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                    <div className="absolute left-3 top-3 bg-black/40 px-2 py-1 rounded text-xs capitalize">
                      {l.category}
                    </div>
                    <div className="absolute right-3 top-3 bg-black/40 px-2 py-1 rounded text-xs">
                      {l.address.city}
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="text-lg font-semibold">{l.name}</h3>
                    <p className="text-sm text-zinc-400 mt-2 line-clamp-2">
                      {l.description}
                    </p>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm text-zinc-300 capitalize">
                        {l.service_type} • {l.category}
                      </div>
                      <div className="text-lg font-bold">
                        ₹{l.price_per_unit.toLocaleString("en-IN")} / {l.unit}
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="p-4 pt-0">
                  <Link
                    href={`/search/${l.id}`}
                    className="block w-full text-center bg-purple-600 hover:bg-purple-700 rounded-md py-2 mt-2 font-semibold transition"
                  >
                    Book now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
