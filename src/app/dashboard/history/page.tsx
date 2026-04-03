"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/config";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { Calendar, MapPin, DollarSign, Package, Clock, CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Booking {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  status: string;
  service_type?: string;
  created_at: string;
  listing_name?: string;
  listing_image?: string;
}

interface Listing {
  id: string;
  name: string;
  service_type: string;
  category: string;
  description: string;
  images: string[];
  price_per_unit: number;
  unit: string;
  approved: boolean;
  created_at: string;
  address?: {
    city: string;
    state: string;
  };
}

export default function HistoryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [activeTab, setActiveTab] = useState<"bookings" | "listings">("bookings");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        await fetchUserHistory(user.uid);
      } else {
        router.push("/auth");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  async function fetchUserHistory(userId: string) {
    try {
      // Fetch bookings
      const bookingsRef = collection(db, "bookings");
      const bookingsQuery = query(
        bookingsRef,
        where("user_id", "==", userId),
        orderBy("created_at", "desc")
      );
      
      const bookingsSnap = await getDocs(bookingsQuery);
      const bookingsData: Booking[] = [];

      for (const bookingDoc of bookingsSnap.docs) {
        const bookingData = bookingDoc.data();
        
        // Fetch listing details
        let listingName = "Unknown Listing";
        let listingImage = "";
        
        try {
          const listingRef = doc(db, "listings", bookingData.listing_id);
          const listingSnap = await getDoc(listingRef);
          if (listingSnap.exists()) {
            const listingData = listingSnap.data();
            listingName = listingData.name || "Unknown Listing";
            listingImage = listingData.images?.[0] || "";
          }
        } catch (err) {
          console.error("Error fetching listing:", err);
        }

        bookingsData.push({
          id: bookingDoc.id,
          listing_id: bookingData.listing_id,
          start_date: bookingData.start_date || "",
          end_date: bookingData.end_date || "",
          total_amount: bookingData.total_amount || 0,
          status: bookingData.status || "pending",
          service_type: bookingData.service_type || "",
          created_at: bookingData.created_at || "",
          listing_name: listingName,
          listing_image: listingImage,
        });
      }

      setBookings(bookingsData);

      // Fetch listings (venues/services added by user)
      const listingsRef = collection(db, "listings");
      const listingsQuery = query(
        listingsRef,
        where("user_id", "==", userId),
        orderBy("created_at", "desc")
      );

      const listingsSnap = await getDocs(listingsQuery);
      const listingsData: Listing[] = listingsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Listing));

      setListings(listingsData);
    } catch (error: any) {
      console.error("Error fetching history:", error);
      // If orderBy fails, try without it
      if (error.code === "failed-precondition") {
        try {
          const bookingsRef = collection(db, "bookings");
          const bookingsQuery = query(bookingsRef, where("user_id", "==", userId));
          const bookingsSnap = await getDocs(bookingsQuery);
          const bookingsData: Booking[] = [];

          for (const bookingDoc of bookingsSnap.docs) {
            const bookingData = bookingDoc.data();
            let listingName = "Unknown Listing";
            let listingImage = "";
            
            try {
              const listingRef = doc(db, "listings", bookingData.listing_id);
              const listingSnap = await getDoc(listingRef);
              if (listingSnap.exists()) {
                const listingData = listingSnap.data();
                listingName = listingData.name || "Unknown Listing";
                listingImage = listingData.images?.[0] || "";
              }
            } catch (err) {
              console.error("Error fetching listing:", err);
            }

            bookingsData.push({
              id: bookingDoc.id,
              listing_id: bookingData.listing_id,
              start_date: bookingData.start_date || "",
              end_date: bookingData.end_date || "",
              total_amount: bookingData.total_amount || 0,
              status: bookingData.status || "pending",
              service_type: bookingData.service_type || "",
              created_at: bookingData.created_at || "",
              listing_name: listingName,
              listing_image: listingImage,
            });
          }

          // Sort manually by created_at
          bookingsData.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
          });

          setBookings(bookingsData);

          const listingsRef = collection(db, "listings");
          const listingsQuery = query(listingsRef, where("user_id", "==", userId));
          const listingsSnap = await getDocs(listingsQuery);
          const listingsData: Listing[] = listingsSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Listing));

          listingsData.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA;
          });

          setListings(listingsData);
        } catch (fallbackError) {
          console.error("Error in fallback fetch:", fallbackError);
        }
      }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "approved":
        return <CheckCircle size={16} className="text-green-400" />;
      case "cancelled":
      case "rejected":
        return <XCircle size={16} className="text-red-400" />;
      case "pending":
        return <AlertCircle size={16} className="text-yellow-400" />;
      default:
        return <Clock size={16} className="text-zinc-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "approved":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "cancelled":
      case "rejected":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white">Loading history...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white mb-2">History</h1>
        <p className="text-zinc-400 text-sm">View your booking and listing history</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("bookings")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "bookings"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Bookings ({bookings.length})
        </button>
        <button
          onClick={() => setActiveTab("listings")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "listings"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-zinc-400 hover:text-zinc-300"
          }`}
        >
          My Listings ({listings.length})
        </button>
      </div>

      {/* Bookings Tab */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <Package size={48} className="mx-auto text-zinc-600 mb-4" />
              <p className="text-zinc-400 mb-2">No bookings yet</p>
              <Link
                href="/search"
                className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
              >
                Browse services <ExternalLink size={14} />
              </Link>
            </div>
          ) : (
            bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Listing Image */}
                  {booking.listing_image && (
                    <div className="w-full md:w-32 h-32 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={booking.listing_image}
                        alt={booking.listing_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>
                  )}

                  {/* Booking Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {booking.listing_name}
                        </h3>
                        {booking.service_type && (
                          <p className="text-sm text-zinc-400 capitalize">
                            {booking.service_type}
                          </p>
                        )}
                      </div>
                      <div
                        className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(
                          booking.status
                        )}`}
                      >
                        {getStatusIcon(booking.status)}
                        <span className="capitalize">{booking.status}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <Calendar size={16} className="text-zinc-500" />
                        <span>
                          {booking.start_date && format(new Date(booking.start_date), "MMM dd, yyyy")}
                          {booking.end_date && ` - ${format(new Date(booking.end_date), "MMM dd, yyyy")}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <DollarSign size={16} className="text-zinc-500" />
                        <span>₹{booking.total_amount.toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    {booking.created_at && (
                      <p className="text-xs text-zinc-500">
                        Booked on {format(new Date(booking.created_at), "MMM dd, yyyy 'at' h:mm a")}
                      </p>
                    )}

                    <div className="mt-4">
                      <Link
                        href={`/search/${booking.listing_id}`}
                        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View listing <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Listings Tab */}
      {activeTab === "listings" && (
        <div className="space-y-4">
          {listings.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <Package size={48} className="mx-auto text-zinc-600 mb-4" />
              <p className="text-zinc-400 mb-2">No listings yet</p>
              <Link
                href="/add-venue"
                className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1"
              >
                List your service <ExternalLink size={14} />
              </Link>
            </div>
          ) : (
            listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Listing Image */}
                  {listing.images && listing.images.length > 0 && (
                    <div className="w-full md:w-32 h-32 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={listing.images[0]}
                        alt={listing.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>
                  )}

                  {/* Listing Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {listing.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <span className="capitalize">{listing.service_type}</span>
                          {listing.category && (
                            <>
                              <span>•</span>
                              <span>{listing.category}</span>
                            </>
                          )}
                          {listing.address && (
                            <>
                              <span>•</span>
                              <MapPin size={12} className="inline" />
                              <span>
                                {listing.address.city}
                                {listing.address.state && `, ${listing.address.state}`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div
                        className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${
                          listing.approved
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        }`}
                      >
                        {listing.approved ? (
                          <CheckCircle size={16} />
                        ) : (
                          <AlertCircle size={16} />
                        )}
                        <span>{listing.approved ? "Approved" : "Pending Approval"}</span>
                      </div>
                    </div>

                    {listing.description && (
                      <p className="text-sm text-zinc-300 mb-3 line-clamp-2">
                        {listing.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-300">
                        <DollarSign size={16} className="text-zinc-500" />
                        <span>
                          ₹{listing.price_per_unit.toLocaleString("en-IN")} / {listing.unit}
                        </span>
                      </div>
                      {listing.created_at && (
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <Clock size={14} />
                          <span>
                            Created {format(new Date(listing.created_at), "MMM dd, yyyy")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/search/${listing.id}`}
                        className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View listing <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
