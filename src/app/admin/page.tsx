"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, getDoc, query, orderBy, where, updateDoc } from "firebase/firestore";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table";
import { Badge } from "@/components/badge";
import { Input } from "@/components/input";

/** Full booking record for admin (Firestore + joined labels). */
interface AdminBooking {
  id: string;
  listing_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  unit?: string;
  price_per_unit?: number;
  total_units?: number;
  subtotal?: number;
  discount_amount?: number;
  total_amount: number;
  commission_amount?: number;
  service_fee?: number;
  status: string;
  payment_status?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  service_type?: string;
  excluded_dates?: string[] | null;
  created_at: string;
  listing_name: string;
  listing_city?: string;
  listing_state?: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  host_name: string;
  host_email: string;
}

interface ListingData {
  id: string;
  service_type: string; // venue, decorator, caterer, dj, photographer
  category: string;
  name: string;
  description: string;
  address: {
    address1: string;
    address2?: string;
    country: string;
    state: string;
    city: string;
    pincode: string;
    googlePin?: string;
  };
  features: Record<string, number>;
  images: string[];
  unit: string;
  price_per_unit: number;
  discounts: Array<{ min_units: number; percent: number }>;
  user_id: string;
  created_at: string;
  updated_at: string;
  availability_start_date?: string | null;
  availability_end_date?: string | null;
  excluded_dates?: string[];
  approved?: boolean;
  // Joined data
  user_name?: string;
  user_email?: string;
  user_phone?: string;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [listings, setListings] = useState<ListingData[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [expandedListing, setExpandedListing] = useState<string | null>(null);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<"listings" | "bookings">("listings");
  const router = useRouter();

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("");
  const [bookingSearchQuery, setBookingSearchQuery] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>("all");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth");
        return;
      }

      try {
        // Check if user is admin
        const profileRef = doc(db, "profiles", user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists()) {
          router.push("/");
          return;
        }

        const profileData = profileSnap.data();
        if (profileData.role !== "admin") {
          setIsAdmin(false);
          setCheckingAuth(false);
          setLoading(false);
          return;
        }

        setIsAdmin(true);
        setCheckingAuth(false);

        // Fetch all listings/services
        const listingsRef = collection(db, "listings");
        let listingsQuery;
        try {
          listingsQuery = query(listingsRef, orderBy("created_at", "desc"));
        } catch (error) {
          // If orderBy fails (index might not exist), try without ordering
          console.warn("OrderBy failed, fetching without order:", error);
          listingsQuery = query(listingsRef);
        }
        
        const listingsSnap = await getDocs(listingsQuery);
        console.log("Total listings found:", listingsSnap.docs.length);

        const listingsData: ListingData[] = [];

        // For each listing, fetch user details
        for (const listingDoc of listingsSnap.docs) {
          const listingData = listingDoc.data() as Omit<ListingData, "id" | "user_name" | "user_email" | "user_phone">;
          const listing: ListingData = {
            id: listingDoc.id,
            ...listingData,
            user_name: "N/A",
            user_email: "N/A",
            user_phone: "N/A",
          };

          // Fetch user details
          if (listingData.user_id) {
            try {
              const userRef = doc(db, "profiles", listingData.user_id);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data();
                listing.user_name = userData.full_name || userData.username || "Unknown User";
                listing.user_email = userData.email || "N/A";
                listing.user_phone = userData.phone || "N/A";
              } else {
                console.warn("User profile not found for user_id:", listingData.user_id);
              }
            } catch (error) {
              console.error("Error fetching user:", error);
            }
          }

          listingsData.push(listing);
        }

        console.log("Processed listings:", listingsData.length);
        setListings(listingsData);

        // All bookings (admin)
        const bookingsRef = collection(db, "bookings");
        let bookingsSnap;
        try {
          bookingsSnap = await getDocs(
            query(bookingsRef, orderBy("created_at", "desc"))
          );
        } catch (orderErr) {
          console.warn("Bookings orderBy failed, fetching unsorted:", orderErr);
          bookingsSnap = await getDocs(bookingsRef);
        }

        const bookingsData: AdminBooking[] = [];
        for (const bookingDoc of bookingsSnap.docs) {
          const b = bookingDoc.data() as Record<string, unknown>;
          const listingId = String(b.listing_id ?? "");
          const guestId = String(b.user_id ?? "");

          let listing_name = "Unknown listing";
          let listing_city: string | undefined;
          let listing_state: string | undefined;
          let host_name = "N/A";
          let host_email = "N/A";

          if (listingId) {
            try {
              const listingSnap = await getDoc(doc(db, "listings", listingId));
              if (listingSnap.exists()) {
                const L = listingSnap.data() as {
                  name?: string;
                  address?: { city?: string; state?: string };
                  user_id?: string;
                };
                listing_name = L.name || listing_name;
                listing_city = L.address?.city;
                listing_state = L.address?.state;
                if (L.user_id) {
                  try {
                    const hostSnap = await getDoc(doc(db, "profiles", L.user_id));
                    if (hostSnap.exists()) {
                      const H = hostSnap.data() as Record<string, string>;
                      host_name =
                        H.full_name || H.username || "Host";
                      host_email = H.email || "N/A";
                    }
                  } catch {
                    /* ignore */
                  }
                }
              }
            } catch {
              /* ignore */
            }
          }

          let guest_name = "Unknown guest";
          let guest_email = "N/A";
          let guest_phone = "N/A";
          if (guestId) {
            try {
              const guestSnap = await getDoc(doc(db, "profiles", guestId));
              if (guestSnap.exists()) {
                const G = guestSnap.data() as Record<string, string>;
                guest_name = G.full_name || G.username || guest_name;
                guest_email = G.email || guest_email;
                guest_phone = G.phone || guest_phone;
              }
            } catch {
              /* ignore */
            }
          }

          const excluded = b.excluded_dates;
          bookingsData.push({
            id: bookingDoc.id,
            listing_id: listingId,
            user_id: guestId,
            start_date: String(b.start_date ?? ""),
            end_date: String(b.end_date ?? ""),
            unit: b.unit !== undefined ? String(b.unit) : undefined,
            price_per_unit:
              typeof b.price_per_unit === "number" ? b.price_per_unit : undefined,
            total_units:
              typeof b.total_units === "number" ? b.total_units : undefined,
            subtotal:
              typeof b.subtotal === "number" ? b.subtotal : undefined,
            discount_amount:
              typeof b.discount_amount === "number"
                ? b.discount_amount
                : undefined,
            total_amount:
              typeof b.total_amount === "number" ? b.total_amount : 0,
            commission_amount:
              typeof b.commission_amount === "number"
                ? b.commission_amount
                : undefined,
            service_fee:
              typeof b.service_fee === "number" ? b.service_fee : undefined,
            status: String(b.status ?? "pending"),
            payment_status:
              b.payment_status !== undefined
                ? String(b.payment_status)
                : undefined,
            razorpay_order_id:
              b.razorpay_order_id !== undefined
                ? String(b.razorpay_order_id)
                : undefined,
            razorpay_payment_id:
              b.razorpay_payment_id !== undefined
                ? String(b.razorpay_payment_id)
                : undefined,
            service_type:
              b.service_type !== undefined
                ? String(b.service_type)
                : undefined,
            excluded_dates: Array.isArray(excluded)
              ? (excluded as string[])
              : excluded === null
                ? null
                : undefined,
            created_at: String(b.created_at ?? ""),
            listing_name,
            listing_city,
            listing_state,
            guest_name,
            guest_email,
            guest_phone,
            host_name,
            host_email,
          });
        }

        bookingsData.sort((a, b) => {
          const ta = new Date(a.created_at).getTime();
          const tb = new Date(b.created_at).getTime();
          return tb - ta;
        });
        setBookings(bookingsData);

        setLoading(false);
      } catch (error) {
        console.error("Error loading admin dashboard:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Filter listings based on search and filters
  const filteredListings = useMemo(() => {
    return listings.filter((listing) => {
      // Search query filter (searches in name, service type, category, location, owner name/email)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          listing.name.toLowerCase().includes(query) ||
          listing.service_type.toLowerCase().includes(query) ||
          listing.category.toLowerCase().includes(query) ||
          listing.address.city.toLowerCase().includes(query) ||
          listing.address.state.toLowerCase().includes(query) ||
          listing.user_name?.toLowerCase().includes(query) ||
          listing.user_email?.toLowerCase().includes(query) ||
          listing.description?.toLowerCase().includes(query);
        
        if (!matchesSearch) return false;
      }

      // Service type filter
      if (serviceTypeFilter !== "all" && listing.service_type !== serviceTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === "approved" && !listing.approved) {
        return false;
      }
      if (statusFilter === "pending" && listing.approved) {
        return false;
      }

      // Location filter
      if (locationFilter) {
        const location = locationFilter.toLowerCase();
        const matchesLocation =
          listing.address.city.toLowerCase().includes(location) ||
          listing.address.state.toLowerCase().includes(location);
        
        if (!matchesLocation) return false;
      }

      return true;
    });
  }, [listings, searchQuery, serviceTypeFilter, statusFilter, locationFilter]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (bookingStatusFilter !== "all") {
        const st = b.status.toLowerCase();
        const pay = (b.payment_status || "").toLowerCase();
        if (bookingStatusFilter === "paid" && pay !== "paid") return false;
        if (bookingStatusFilter === "confirmed" && st !== "confirmed") return false;
        if (bookingStatusFilter === "pending" && st !== "pending") return false;
      }
      if (!bookingSearchQuery.trim()) return true;
      const q = bookingSearchQuery.toLowerCase();
      return (
        b.id.toLowerCase().includes(q) ||
        b.listing_id.toLowerCase().includes(q) ||
        b.listing_name.toLowerCase().includes(q) ||
        b.guest_name.toLowerCase().includes(q) ||
        b.guest_email.toLowerCase().includes(q) ||
        (b.razorpay_order_id || "").toLowerCase().includes(q) ||
        (b.razorpay_payment_id || "").toLowerCase().includes(q) ||
        (b.user_id || "").toLowerCase().includes(q)
      );
    });
  }, [bookings, bookingSearchQuery, bookingStatusFilter]);

  // Get unique service types for filter dropdown
  const uniqueServiceTypes = useMemo(() => {
    const types = new Set(listings.map(l => l.service_type));
    return Array.from(types).sort();
  }, [listings]);

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-zinc-400 mb-4">You do not have admin privileges.</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleApproveListing = async (listingId: string, approved: boolean) => {
    try {
      const listingRef = doc(db, "listings", listingId);
      await updateDoc(listingRef, {
        approved: approved,
        updated_at: new Date().toISOString(),
      });
      
      // Update local state
      setListings(prevListings =>
        prevListings.map(listing =>
          listing.id === listingId ? { ...listing, approved } : listing
        )
      );
    } catch (error) {
      console.error("Error updating listing approval:", error);
      alert("Failed to update listing approval status");
    }
  };


  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-zinc-400">
            {adminTab === "listings"
              ? "All service listings (venues, decorators, caterers, DJs, photographers)"
              : "All customer bookings — dates, amounts, guests, hosts, and payment references"}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={() => setAdminTab("listings")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                adminTab === "listings"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Listings ({listings.length})
            </button>
            <button
              type="button"
              onClick={() => setAdminTab("bookings")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                adminTab === "bookings"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              Bookings ({bookings.length})
            </button>
          </div>
        </div>

        {adminTab === "listings" && (
        <>
        {/* Search and Filter Section */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Search
              </label>
              <Input
                type="text"
                placeholder="Search by name, type, category, location, owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
              />
            </div>

            {/* Service Type Filter */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Service Type
              </label>
              <select
                value={serviceTypeFilter}
                onChange={(e) => setServiceTypeFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800/50 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {uniqueServiceTypes.map((type) => (
                  <option key={type} value={type} className="bg-zinc-800">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800/50 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="approved" className="bg-zinc-800">Approved</option>
                <option value="pending" className="bg-zinc-800">Pending</option>
              </select>
            </div>
          </div>

          {/* Location Filter */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Location (City/State)
            </label>
            <Input
              type="text"
              placeholder="Filter by city or state..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 max-w-md"
            />
          </div>

          {/* Active Filters Summary */}
          {(searchQuery || serviceTypeFilter !== "all" || statusFilter !== "all" || locationFilter) && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-zinc-400">Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary" className="bg-blue-600/30 text-blue-300">
                  Search: {searchQuery}
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="ml-2 hover:text-blue-200 cursor-pointer font-bold text-base leading-none"
                    aria-label="Clear search filter"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {serviceTypeFilter !== "all" && (
                <Badge variant="secondary" className="bg-blue-600/30 text-blue-300">
                  Type: {serviceTypeFilter}
                  <button
                    type="button"
                    onClick={() => setServiceTypeFilter("all")}
                    className="ml-2 hover:text-blue-200 cursor-pointer font-bold text-base leading-none"
                    aria-label="Clear service type filter"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="bg-blue-600/30 text-blue-300">
                  Status: {statusFilter}
                  <button
                    type="button"
                    onClick={() => setStatusFilter("all")}
                    className="ml-2 hover:text-blue-200 cursor-pointer font-bold text-base leading-none"
                    aria-label="Clear status filter"
                  >
                    ×
                  </button>
                </Badge>
              )}
              {locationFilter && (
                <Badge variant="secondary" className="bg-blue-600/30 text-blue-300">
                  Location: {locationFilter}
                  <button
                    type="button"
                    onClick={() => setLocationFilter("")}
                    className="ml-2 hover:text-blue-200 cursor-pointer font-bold text-base leading-none"
                    aria-label="Clear location filter"
                  >
                    ×
                  </button>
                </Badge>
              )}
              <button
                onClick={() => {
                  setSearchQuery("");
                  setServiceTypeFilter("all");
                  setStatusFilter("all");
                  setLocationFilter("");
                }}
                className="text-sm text-blue-400 hover:text-blue-300 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {listings.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 text-center">
            <p className="text-zinc-400 text-lg">No service listings found.</p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-zinc-300">
              Total Listings: <span className="font-semibold text-white">{listings.length}</span>
              {filteredListings.length !== listings.length && (
                <>
                  {" "}
                  | Filtered: <span className="font-semibold text-white">{filteredListings.length}</span>
                </>
              )}
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead className="text-zinc-300"></TableHead>
                      <TableHead className="text-zinc-300">Listing ID</TableHead>
                      <TableHead className="text-zinc-300">Service Type</TableHead>
                      <TableHead className="text-zinc-300">Category</TableHead>
                      <TableHead className="text-zinc-300">Name</TableHead>
                      <TableHead className="text-zinc-300">Location</TableHead>
                      <TableHead className="text-zinc-300">Price/{""}</TableHead>
                      <TableHead className="text-zinc-300">Owner</TableHead>
                      <TableHead className="text-zinc-300">Contact</TableHead>
                      <TableHead className="text-zinc-300">Images</TableHead>
                      <TableHead className="text-zinc-300">Status</TableHead>
                      <TableHead className="text-zinc-300">Created At</TableHead>
                      <TableHead className="text-zinc-300">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredListings.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="text-center py-8 text-zinc-400">
                          No listings match your filters. Try adjusting your search criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredListings.map((listing) => (
                      <React.Fragment key={listing.id}>
                        <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                          <TableCell>
                            <button
                              onClick={() => setExpandedListing(expandedListing === listing.id ? null : listing.id)}
                              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                            >
                              {expandedListing === listing.id ? "▼" : "▶"}
                            </button>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-blue-400">
                            {listing.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-medium">
                            <span className="capitalize">{listing.service_type}</span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{listing.category}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{listing.name}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{listing.address.city}, {listing.address.state}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatCurrency(listing.price_per_unit)} / {listing.unit}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium">{listing.user_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              <div className="text-blue-400 text-xs">{listing.user_email}</div>
                              {listing.user_phone !== "N/A" && (
                                <div className="text-zinc-500 text-xs">{listing.user_phone}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {listing.images?.length || 0} image(s)
                            </div>
                          </TableCell>
                          <TableCell>
                            {listing.approved ? (
                              <span className="px-2 py-1 text-xs bg-green-600/30 text-green-400 rounded">Approved</span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-yellow-600/30 text-yellow-400 rounded">Pending</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-zinc-400">
                            {formatDate(listing.created_at)}
                          </TableCell>
                          <TableCell>
                            {listing.approved ? (
                              <button
                                onClick={() => handleApproveListing(listing.id, false)}
                                className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                              >
                                Reject
                              </button>
                            ) : (
                              <button
                                onClick={() => handleApproveListing(listing.id, true)}
                                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded"
                              >
                                Approve
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                        {expandedListing === listing.id && (
                          <TableRow>
                            <TableCell colSpan={13} className="bg-zinc-900/70 p-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Images */}
                                {listing.images && listing.images.length > 0 ? (
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3">Service Images</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                      {listing.images.map((url, idx) => (
                                        <div key={idx} className="relative">
                                          <img
                                            src={url}
                                            alt={`Image ${idx + 1}`}
                                            className="w-full h-40 object-cover rounded-lg border border-zinc-700"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <h3 className="text-lg font-semibold mb-3">Service Images</h3>
                                    <p className="text-zinc-400 text-sm">No images available</p>
                                  </div>
                                )}
                                
                                {/* Listing Details */}
                                <div>
                                  <h3 className="text-lg font-semibold mb-3">Listing Details</h3>
                                  <div className="space-y-2 text-sm">
                                    <div>
                                      <span className="text-zinc-400">Listing ID: </span>
                                      <span className="text-zinc-200 font-mono text-xs">{listing.id}</span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-400">Service Type: </span>
                                      <span className="text-zinc-200 capitalize">{listing.service_type}</span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-400">Category: </span>
                                      <span className="text-zinc-200">{listing.category}</span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-400">Name: </span>
                                      <span className="text-zinc-200">{listing.name}</span>
                                    </div>
                                    <div>
                                      <span className="text-zinc-400">Description: </span>
                                      <p className="text-zinc-200 text-xs mt-1">{listing.description}</p>
                                    </div>
                                    <div>
                                      <span className="text-zinc-400">Address: </span>
                                      <p className="text-zinc-200 text-xs mt-1">
                                        {listing.address.address1}
                                        {listing.address.address2 && `, ${listing.address.address2}`}
                                        <br />
                                        {listing.address.city}, {listing.address.state}
                                        <br />
                                        {listing.address.country} - {listing.address.pincode}
                                      </p>
                                    </div>
                                    {Object.keys(listing.features || {}).length > 0 && (
                                      <div>
                                        <span className="text-zinc-400">Features: </span>
                                        <div className="mt-1 flex flex-wrap gap-2">
                                          {Object.entries(listing.features).map(([key, value]) => (
                                            <span key={key} className="px-2 py-1 bg-blue-600/30 rounded text-xs">
                                              {key} ({value})
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-zinc-400">Pricing: </span>
                                      <span className="text-zinc-200">
                                        {formatCurrency(listing.price_per_unit)} per {listing.unit}
                                      </span>
                                    </div>
                                    {listing.discounts && listing.discounts.length > 0 && (
                                      <div>
                                        <span className="text-zinc-400">Discounts: </span>
                                        <div className="mt-1 text-xs">
                                          {listing.discounts.map((d, idx) => (
                                            <div key={idx} className="text-zinc-200">
                                              {d.min_units}+ units: {d.percent}% off
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {(listing.availability_start_date || listing.availability_end_date) && (
                                      <div>
                                        <span className="text-zinc-400">Availability: </span>
                                        <div className="mt-1 text-xs text-zinc-200">
                                          {listing.availability_start_date ? (
                                            <div>
                                              From: {formatDate(listing.availability_start_date)}
                                            </div>
                                          ) : null}
                                          {listing.availability_end_date ? (
                                            <div>
                                              To: {formatDate(listing.availability_end_date)}
                                            </div>
                                          ) : null}
                                          {listing.excluded_dates && listing.excluded_dates.length > 0 && (
                                            <div className="mt-2">
                                              <span className="text-zinc-400">Excluded Dates ({listing.excluded_dates.length}): </span>
                                              <div className="mt-1 flex flex-wrap gap-1">
                                                {listing.excluded_dates.slice(0, 10).map((date, idx) => (
                                                  <span key={idx} className="px-2 py-1 bg-red-600/30 rounded text-xs">
                                                    {formatDate(date)}
                                                  </span>
                                                ))}
                                                {listing.excluded_dates.length > 10 && (
                                                  <span className="px-2 py-1 bg-zinc-700 rounded text-xs">
                                                    +{listing.excluded_dates.length - 10} more
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
        </>
        )}

        {adminTab === "bookings" && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Search bookings
                  </label>
                  <Input
                    type="text"
                    placeholder="Booking ID, listing, guest, email, Razorpay id…"
                    value={bookingSearchQuery}
                    onChange={(e) => setBookingSearchQuery(e.target.value)}
                    className="bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Filter by status
                  </label>
                  <select
                    value={bookingStatusFilter}
                    onChange={(e) => setBookingStatusFilter(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800/50 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="confirmed">Booking confirmed</option>
                    <option value="paid">Payment paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            {bookings.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 text-center">
                <p className="text-zinc-400 text-lg">No bookings yet.</p>
              </div>
            ) : (
              <>
                <div className="mb-2 text-zinc-300">
                  Total: <span className="font-semibold text-white">{bookings.length}</span>
                  {filteredBookings.length !== bookings.length && (
                    <>
                      {" "}
                      | Shown:{" "}
                      <span className="font-semibold text-white">
                        {filteredBookings.length}
                      </span>
                    </>
                  )}
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-zinc-800">
                          <TableHead className="text-zinc-300 w-10"></TableHead>
                          <TableHead className="text-zinc-300">Created</TableHead>
                          <TableHead className="text-zinc-300">Guest</TableHead>
                          <TableHead className="text-zinc-300">Listing</TableHead>
                          <TableHead className="text-zinc-300">Dates</TableHead>
                          <TableHead className="text-zinc-300">Total</TableHead>
                          <TableHead className="text-zinc-300">Booking</TableHead>
                          <TableHead className="text-zinc-300">Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBookings.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="text-center py-8 text-zinc-400"
                            >
                              No bookings match your filters.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredBookings.map((b) => (
                            <React.Fragment key={b.id}>
                              <TableRow className="border-zinc-800 hover:bg-zinc-800/50">
                                <TableCell>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedBooking(
                                        expandedBooking === b.id ? null : b.id
                                      )
                                    }
                                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                                  >
                                    {expandedBooking === b.id ? "▼" : "▶"}
                                  </button>
                                </TableCell>
                                <TableCell className="text-sm text-zinc-300 whitespace-nowrap">
                                  {b.created_at
                                    ? formatDate(b.created_at)
                                    : "—"}
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm font-medium text-white">
                                    {b.guest_name}
                                  </div>
                                  <div className="text-xs text-blue-400">
                                    {b.guest_email}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm text-white max-w-[200px] truncate">
                                    {b.listing_name}
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    {b.listing_city}
                                    {b.listing_state
                                      ? `, ${b.listing_state}`
                                      : ""}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-zinc-300 whitespace-nowrap">
                                  <div>
                                    {b.start_date
                                      ? formatDate(b.start_date)
                                      : "—"}{" "}
                                    →{" "}
                                    {b.end_date
                                      ? formatDate(b.end_date)
                                      : "—"}
                                  </div>
                                  {b.total_units != null && (
                                    <div className="text-xs text-zinc-500">
                                      {b.total_units} {b.unit || "units"}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-semibold text-green-400 whitespace-nowrap">
                                  {formatCurrency(b.total_amount)}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`px-2 py-1 text-xs rounded ${
                                      b.status === "confirmed"
                                        ? "bg-green-600/30 text-green-400"
                                        : "bg-yellow-600/30 text-yellow-400"
                                    }`}
                                  >
                                    {b.status}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {b.payment_status ? (
                                    <span className="px-2 py-1 text-xs rounded bg-emerald-600/30 text-emerald-300">
                                      {b.payment_status}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-500 text-xs">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                              {expandedBooking === b.id && (
                                <TableRow>
                                  <TableCell
                                    colSpan={8}
                                    className="bg-zinc-900/70 p-6 align-top"
                                  >
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-sm">
                                      <div className="space-y-3">
                                        <h3 className="text-lg font-semibold text-white mb-2">
                                          Guest (booker)
                                        </h3>
                                        <div>
                                          <span className="text-zinc-400">Name: </span>
                                          <span className="text-zinc-100">
                                            {b.guest_name}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-zinc-400">Email: </span>
                                          <span className="text-zinc-100">
                                            {b.guest_email}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-zinc-400">Phone: </span>
                                          <span className="text-zinc-100">
                                            {b.guest_phone}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-zinc-400">User ID: </span>
                                          <span className="text-zinc-200 font-mono text-xs break-all">
                                            {b.user_id || "—"}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-3">
                                        <h3 className="text-lg font-semibold text-white mb-2">
                                          Host (listing owner)
                                        </h3>
                                        <div>
                                          <span className="text-zinc-400">Name: </span>
                                          <span className="text-zinc-100">
                                            {b.host_name}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-zinc-400">Email: </span>
                                          <span className="text-zinc-100">
                                            {b.host_email}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-3 lg:col-span-2 border-t border-zinc-800 pt-4">
                                        <h3 className="text-lg font-semibold text-white mb-2">
                                          Booking & pricing
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                                          <div>
                                            <span className="text-zinc-400">
                                              Booking document ID:{" "}
                                            </span>
                                            <span className="text-zinc-200 font-mono text-xs break-all">
                                              {b.id}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Listing ID:{" "}
                                            </span>
                                            <span className="text-zinc-200 font-mono text-xs break-all">
                                              {b.listing_id}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Service type:{" "}
                                            </span>
                                            <span className="text-zinc-100 capitalize">
                                              {b.service_type || "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">Unit: </span>
                                            <span className="text-zinc-100">
                                              {b.unit || "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Price / unit:{" "}
                                            </span>
                                            <span className="text-zinc-100">
                                              {b.price_per_unit != null
                                                ? formatCurrency(b.price_per_unit)
                                                : "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Total units:{" "}
                                            </span>
                                            <span className="text-zinc-100">
                                              {b.total_units ?? "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Subtotal:{" "}
                                            </span>
                                            <span className="text-zinc-100">
                                              {b.subtotal != null
                                                ? formatCurrency(b.subtotal)
                                                : "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Discount:{" "}
                                            </span>
                                            <span className="text-zinc-100">
                                              {b.discount_amount != null
                                                ? formatCurrency(b.discount_amount)
                                                : "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Commission:{" "}
                                            </span>
                                            <span className="text-zinc-100">
                                              {b.commission_amount != null
                                                ? formatCurrency(b.commission_amount)
                                                : "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Service fee:{" "}
                                            </span>
                                            <span className="text-zinc-100">
                                              {b.service_fee != null
                                                ? formatCurrency(b.service_fee)
                                                : "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Total amount:{" "}
                                            </span>
                                            <span className="text-green-400 font-semibold">
                                              {formatCurrency(b.total_amount)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="space-y-3 lg:col-span-2 border-t border-zinc-800 pt-4">
                                        <h3 className="text-lg font-semibold text-white mb-2">
                                          Razorpay
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2">
                                          <div>
                                            <span className="text-zinc-400">
                                              Order ID:{" "}
                                            </span>
                                            <span className="text-zinc-200 font-mono text-xs break-all">
                                              {b.razorpay_order_id || "—"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-zinc-400">
                                              Payment ID:{" "}
                                            </span>
                                            <span className="text-zinc-200 font-mono text-xs break-all">
                                              {b.razorpay_payment_id || "—"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      {b.excluded_dates &&
                                        b.excluded_dates.length > 0 && (
                                          <div className="lg:col-span-2 border-t border-zinc-800 pt-4">
                                            <h3 className="text-lg font-semibold text-white mb-2">
                                              Excluded dates
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                              {b.excluded_dates.map((d, i) => (
                                                <span
                                                  key={i}
                                                  className="px-2 py-1 bg-red-600/20 text-red-300 rounded text-xs"
                                                >
                                                  {formatDate(d)}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
