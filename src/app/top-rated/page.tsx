"use client";

import { useState, useMemo, useEffect } from "react";
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

export default function TopRatedPage() {
  // Filter states
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
          // Try to order by average_rating descending, fallback to no order if field doesn't exist
          listingsQuery = query(listingsRef, orderBy("average_rating", "desc"));
        } catch (error) {
          console.warn("OrderBy average_rating failed, fetching without order:", error);
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

        // Sort by average_rating descending (in case orderBy failed)
        listingsData.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));

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

  const filtered = useMemo(() => {
    return listings.filter(l => {
      // Filter by service type (category)
      if (category) {
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

      // Filter by rating
      if (stars > 0) {
        const listingRating = l.average_rating || 0;
        if (listingRating < stars) return false;
      }

      // Filter by minimum bookings
      if (bookingsMin > 0) {
        const listingBookings = l.review_count || l.bookingsCount || 0;
        if (listingBookings < bookingsMin) return false;
      }

      // Filter by price
      if (priceMax && l.price_per_unit > priceMax) return false;

      // Filter by amenities/features
      if (amenities.length > 0) {
        const featureKeys = Object.keys(l.features || {});
        for (const am of amenities) {
          if (!featureKeys.some(key => key.toLowerCase().includes(am.toLowerCase()))) {
            return false;
          }
        }
      }

      // Filter by date availability
      if (startDateStr || endDateStr) {
        if (l.availability_start_date && l.availability_end_date) {
          const listingStart = new Date(l.availability_start_date);
          const listingEnd = new Date(l.availability_end_date);
          
          if (startDateStr) {
            const requestedStart = new Date(startDateStr);
            if (requestedStart < listingStart || requestedStart > listingEnd) {
              return false;
            }
          }
          
          if (endDateStr) {
            const requestedEnd = new Date(endDateStr);
            if (requestedEnd < listingStart || requestedEnd > listingEnd) {
              return false;
            }
          }
          
          if (startDateStr && endDateStr) {
            const requestedStart = new Date(startDateStr);
            const requestedEnd = new Date(endDateStr);
            
            if (requestedStart > listingEnd || requestedEnd < listingStart) {
              return false;
            }
            
            if (l.excluded_dates && l.excluded_dates.length > 0) {
              const requestedDates: string[] = [];
              const start = new Date(requestedStart);
              const end = new Date(requestedEnd);
              
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                requestedDates.push(d.toISOString().slice(0, 10));
              }
              
              const hasExcludedDate = requestedDates.some(date => 
                l.excluded_dates?.includes(date)
              );
              if (hasExcludedDate) {
                return false;
              }
            }
          }
        }
      }

      return true;
    });
  }, [
    listings,
    category, subtype, state, city, region,
    stars, bookingsMin, priceMax, amenities,
    startDateStr, endDateStr
  ]);

  // Sort by rating descending (top rated first)
  const sorted = [...filtered].sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white p-6">
      <div className="max-w-7xl mx-auto">
        
        <h1 className="text-4xl font-bold mb-6">Top Rated</h1>

        {/* FULL FILTER BAR */}
        <FilterBar
          category={category} setCategory={setCategory}
          subtype={subtype} setSubtype={setSubtype}
          state={state} setState={setState}
          city={city} setCity={setCity}
          region={region} setRegion={setRegion}
          startDateStr={startDateStr} endDateStr={endDateStr}
          setStartDateStr={setStartDateStr} setEndDateStr={setEndDateStr}
          stars={stars} setStars={setStars}
          bookingsMin={bookingsMin} setBookingsMin={setBookingsMin}
          priceMax={priceMax} setPriceMax={setPriceMax}
          amenities={amenities} setAmenities={setAmenities}
        />

        {/* RESULTS COUNT */}
        {loading ? (
          <div className="text-zinc-400 text-sm mb-4">Loading listings...</div>
        ) : (
          <div className="text-zinc-400 text-sm mb-4">{sorted.length} results</div>
        )}

        {/* GRID */}
        {loading ? (
          <div className="text-center py-12 text-zinc-400">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            No listings found. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sorted.map(item => (
              <Link
                key={item.id}
                href={`/search/${item.id}`}
                className="group block rounded-xl bg-[#07162f]/60 border border-zinc-800 overflow-hidden hover:scale-[1.01] transition"
              >
                <div className="relative h-48">
                  <img
                    src={item.images && item.images.length > 0 ? item.images[0] : "/placeholder.svg"}
                    alt={item.name}
                    className="w-full h-full object-cover brightness-90 group-hover:brightness-110 transition"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                  <div className="absolute left-3 top-3 bg-black/50 text-xs px-2 py-1 rounded capitalize">
                    {item.category}
                  </div>
                  <div className="absolute right-3 top-3 bg-black/50 text-xs px-2 py-1 rounded">
                    ⭐ {item.average_rating ? item.average_rating.toFixed(1) : "0.0"}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-lg">{item.name}</h3>
                  <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{item.description}</p>

                  <div className="mt-3 flex justify-between text-sm">
                    <span className="text-zinc-300">
                      {item.address.city} • {item.address.state}
                    </span>
                    <span className="font-bold">
                      ₹{item.price_per_unit.toLocaleString("en-IN")} / {item.unit}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
