"use client";

import { useRouter, useParams } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { db, auth } from "@/lib/firebase/config";
import { doc, getDoc, collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  differenceInCalendarDays,
  parseISO,
  format
} from "date-fns";

interface Listing {
  id: string;
  service_type: string;
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
  images: string[];
  gallery?: { url: string; caption: string }[];
  price_per_unit: number;
  unit: string;
  features?: Record<string, number>;
  discounts?: Array<{ min_units: number; percent: number }>;
  user_id?: string;
  owner_name?: string;
  owner_joined_at?: string | null;
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay is only available in the browser"));
  }
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      if (window.Razorpay) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Razorpay checkout"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

export default function ListingDetail() {
  const router = useRouter();
  const params = useParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // ✅ Safe extraction
  const id = typeof params?.id === "string" ? params.id : "";

  const nights = useMemo(() => {
    if (!startDate || !endDate) return 0;
    try {
      return differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
    } catch {
      return 0;
    }
  }, [startDate, endDate]);

  const totalPrice = useMemo(() => {
    if (!listing || nights <= 0) return 0;
    let basePrice = nights * listing.price_per_unit;
    
    // Apply discounts if applicable
    if (listing.discounts && listing.discounts.length > 0) {
      const applicableDiscount = listing.discounts
        .filter(d => nights >= d.min_units)
        .sort((a, b) => b.min_units - a.min_units)[0];
      
      if (applicableDiscount) {
        basePrice = basePrice * (1 - applicableDiscount.percent / 100);
      }
    }
    
    return Math.round(basePrice);
  }, [listing, nights]);

  const subtotal = useMemo(() => {
    if (!listing || nights <= 0) return 0;
    return nights * listing.price_per_unit;
  }, [listing, nights]);

  const discountAmount = useMemo(() => {
    if (!listing || nights <= 0) return 0;
    return subtotal - totalPrice;
  }, [subtotal, totalPrice]);

  async function confirmBookingWithPayment() {
    if (!listing || !startDate || !endDate) {
      setBookingError("Please select both start and end dates");
      return;
    }
    if (nights <= 0 || totalPrice <= 0) {
      setBookingError("Invalid booking total. Check your dates.");
      return;
    }

    setSavingBooking(true);
    setBookingError(null);

    try {
      const userId = await new Promise<string | null>((resolve) => {
        const current = auth.currentUser;
        if (current) {
          resolve(current.uid);
          return;
        }
        const unsub = onAuthStateChanged(auth, (user) => {
          unsub();
          resolve(user?.uid ?? null);
        });
      });

      if (!userId) {
        setBookingError("Please sign in to complete your booking");
        setSavingBooking(false);
        return;
      }

      const amountPaise = Math.round(totalPrice * 100);
      if (amountPaise < 100) {
        setBookingError("Minimum payable amount is ₹1.");
        setSavingBooking(false);
        return;
      }

      const createRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          bookingId: `booking_${listing.id}_${Date.now()}`,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) {
        setBookingError(
          (createJson as { message?: string }).message ??
            "Could not start payment. Check Razorpay configuration."
        );
        setSavingBooking(false);
        return;
      }

      const { orderId, razorpayKey, order } = createJson as {
        orderId: string;
        razorpayKey: string;
        order: { amount: number; currency: string };
      };

      await loadRazorpayScript();

      await new Promise<void>((resolve) => {
        let bookingPersisted = false;
        let paymentExplicitlyFailed = false;
        let persistChain: Promise<void> = Promise.resolve();
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        const pollDeadline = Date.now() + 120_000;

        const settle = () => {
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          resolve();
        };

        const persistPaidBooking = (ids: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
        }) => {
          persistChain = persistChain.then(async () => {
            if (bookingPersisted) return;
            await addDoc(collection(db, "bookings"), {
              listing_id: listing.id,
              user_id: userId,
              start_date: startDate,
              end_date: endDate,
              unit: listing.unit,
              price_per_unit: listing.price_per_unit,
              total_units: nights,
              subtotal: subtotal,
              discount_amount: discountAmount,
              total_amount: totalPrice,
              status: "confirmed",
              payment_status: "paid",
              razorpay_order_id: ids.razorpay_order_id,
              razorpay_payment_id: ids.razorpay_payment_id,
              service_type: listing.service_type || undefined,
              created_at: new Date().toISOString(),
            });
            bookingPersisted = true;
            setSavingBooking(false);
            alert("Booking confirmed. Payment successful.");
            setShowBookingModal(false);
          });
          return persistChain;
        };

        const tryServerPaymentSync = async (): Promise<boolean> => {
          try {
            const r = await fetch("/api/razorpay/check-order-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId }),
            });
            if (!r.ok) return false;
            const j = (await r.json()) as {
              razorpay_order_id: string;
              razorpay_payment_id: string;
            };
            await persistPaidBooking(j);
            return bookingPersisted;
          } catch (e) {
            console.error("check-order-payment:", e);
            return false;
          }
        };

        const options: Record<string, unknown> = {
          key: razorpayKey,
          amount: order.amount,
          currency: order.currency,
          name: "ALT",
          description: `Booking · ${listing.name}`,
          order_id: orderId,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await fetch("/api/razorpay/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(response),
              });
              if (verifyRes.ok) {
                await persistPaidBooking({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                });
              } else {
                const verifyJson = (await verifyRes.json()) as {
                  message?: string;
                };
                const synced = await tryServerPaymentSync();
                if (!synced) {
                  setBookingError(
                    verifyJson.message ?? "Payment verification failed"
                  );
                  setSavingBooking(false);
                }
              }
            } catch (e) {
              console.error(e);
              const synced = await tryServerPaymentSync();
              if (!synced) {
                setBookingError(
                  e instanceof Error ? e.message : "Could not complete booking"
                );
                setSavingBooking(false);
              }
            } finally {
              settle();
            }
          },
          prefill: {
            email: auth.currentUser?.email ?? "",
          },
          theme: { color: "#059669" },
          modal: {
            ondismiss: () => {
              void (async () => {
                try {
                  if (
                    !bookingPersisted &&
                    !paymentExplicitlyFailed
                  ) {
                    await tryServerPaymentSync();
                  }
                } finally {
                  if (!bookingPersisted) {
                    setSavingBooking(false);
                  }
                  settle();
                }
              })();
            },
          },
        };

        const rzp = new window.Razorpay(
          options as ConstructorParameters<typeof window.Razorpay>[0]
        );

        pollTimer = setInterval(() => {
          if (Date.now() > pollDeadline) {
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = null;
            return;
          }
          void (async () => {
            if (bookingPersisted || paymentExplicitlyFailed) return;
            const r = await fetch("/api/razorpay/check-order-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId }),
            });
            if (!r.ok) return;
            const j = (await r.json()) as {
              razorpay_order_id: string;
              razorpay_payment_id: string;
            };
            try {
              await persistPaidBooking(j);
              const rzpAny = rzp as unknown as { close?: () => void };
              if (typeof rzpAny.close === "function") {
                rzpAny.close();
              }
            } catch (e) {
              console.error(e);
              setBookingError(
                e instanceof Error ? e.message : "Could not save booking"
              );
              setSavingBooking(false);
            } finally {
              settle();
            }
          })();
        }, 3000);

        rzp.on("payment.failed", (resp: unknown) => {
          const failure = resp as { error?: { description?: string } };
          paymentExplicitlyFailed = true;
          setBookingError(
            failure.error?.description ?? "Payment failed or was cancelled"
          );
          setSavingBooking(false);
          settle();
        });
        rzp.open();
      });
    } catch (err) {
      console.error(err);
      setBookingError(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setSavingBooking(false);
    }
  }

  useEffect(() => {
    async function fetchListing() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const listingRef = doc(db, "listings", id);
        const listingSnap = await getDoc(listingRef);

        if (listingSnap.exists()) {
          const data = listingSnap.data();

          // Fetch basic seller info (no phone or email)
          let ownerName: string | undefined;
          let ownerJoinedAt: string | null = null;

          let galleryItems: { url: string; caption: string }[] = [];

          if (data.user_id) {
            try {
              const userRef = doc(db, "profiles", data.user_id);
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const userData = userSnap.data() as any;
                ownerName =
                  userData.full_name ||
                  userData.username ||
                  "ALT Partner";
                ownerJoinedAt = userData.created_at || null;
              }

              // Fetch gallery images + captions for this host / service / category
              const galleryRef = collection(db, "venue_gallery");
              const galleryQuery = query(galleryRef, where("user_id", "==", data.user_id));
              const gallerySnap = await getDocs(galleryQuery);

              galleryItems = gallerySnap.docs
                .map((docSnap) => docSnap.data() as any)
                .filter((g) => {
                  // Match by service type + category when available to avoid mixing categories
                  const serviceMatch = !data.service_type || g.service_type === data.service_type;
                  const categoryMatch = !data.category || g.category === data.category;
                  return serviceMatch && categoryMatch;
                })
                .sort((a, b) => {
                  const da = a.created_at ? new Date(a.created_at).getTime() : 0;
                  const dbT = b.created_at ? new Date(b.created_at).getTime() : 0;
                  return da - dbT;
                })
                .map((g) => ({
                  url: g.url as string,
                  caption: (g.caption as string) || "",
                }));
            } catch (err) {
              console.error("Error fetching seller profile:", err);
            }
          }

          setListing({
            id: listingSnap.id,
            service_type: data.service_type || "",
            category: data.category || "",
            name: data.name || "",
            description: data.description || "",
            address: data.address || {
              address1: "",
              country: "",
              state: "",
              city: "",
              pincode: "",
            },
            images: data.images || [],
            gallery: galleryItems,
            price_per_unit: data.price_per_unit || 0,
            unit: data.unit || "night",
            features: data.features || {},
            discounts: data.discounts || [],
            user_id: data.user_id,
            owner_name: ownerName,
            owner_joined_at: ownerJoinedAt,
          });
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching listing:", error);
        setLoading(false);
      }
    }

    fetchListing();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Listing not found</h1>
          <button
            onClick={() => router.push("/search")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  const sellerJoinedLabel = listing.owner_joined_at
    ? new Date(listing.owner_joined_at).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Recently joined";

  const imagesWithCaptions =
    listing.gallery && listing.gallery.length > 0
      ? listing.gallery
      : (listing.images || []).map((url) => ({ url, caption: "" }));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#07102a_0%,#03031a_60%)] p-6 text-white">
      
      <button
        onClick={() => router.back()}
        className="text-zinc-300 underline mb-6"
      >
        ← Back
      </button>

      <h1 className="text-4xl font-bold mb-4">{listing.name}</h1>

      {imagesWithCaptions && imagesWithCaptions.length > 0 ? (
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl">
            {imagesWithCaptions.slice(0, 6).map((image, index) => (
              <div
                key={index}
                className="relative aspect-square cursor-pointer group"
                onClick={() => setSelectedImageIndex(index)}
              >
                <img
                  src={image.url}
                  alt={`${listing.name} - Image ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg shadow-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
                {/* Hover caption overlay */}
                {image.caption && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-end p-2">
                    <p className="text-[11px] leading-snug text-zinc-100">
                      {image.caption}
                    </p>
                  </div>
                )}
                {index === 5 && imagesWithCaptions.length > 6 && (
                  <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-bold">
                      +{imagesWithCaptions.length - 6}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-3xl h-64 bg-zinc-800 rounded-xl shadow-lg mb-6 flex items-center justify-center text-zinc-400">
          No image available
        </div>
      )}

      {/* Image Modal/Lightbox */}
      {selectedImageIndex !== null && imagesWithCaptions && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImageIndex(null)}
        >
          <button
            onClick={() => setSelectedImageIndex(null)}
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:text-zinc-400"
          >
            ×
          </button>
          {selectedImageIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(selectedImageIndex - 1);
              }}
              className="absolute left-4 text-white text-4xl hover:text-zinc-400"
            >
              ‹
            </button>
          )}
          <img
          src={imagesWithCaptions[selectedImageIndex].url}
            alt={`${listing.name} - Image ${selectedImageIndex + 1}`}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
          {/* Caption under large image */}
          {imagesWithCaptions[selectedImageIndex].caption && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 max-w-3xl text-center px-4 text-sm text-zinc-100">
              {imagesWithCaptions[selectedImageIndex].caption}
            </div>
          )}
          {selectedImageIndex < imagesWithCaptions.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(selectedImageIndex + 1);
              }}
              className="absolute right-4 text-white text-4xl hover:text-zinc-400"
            >
              ›
            </button>
          )}
          <div className="absolute bottom-4 text-white text-sm">
            {selectedImageIndex + 1} / {imagesWithCaptions.length}
          </div>
        </div>
      )}

      <p className="text-lg text-zinc-300 max-w-3xl mb-8 leading-relaxed">
        {listing.description}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] max-w-6xl">
        {/* Booking card */}
        <div className="bg-[#07102a]/80 border border-zinc-700 rounded-xl p-6">
          <h2 className="text-2xl font-semibold mb-4">
            Book this{" "}
            {listing.service_type
              ? listing.service_type.charAt(0).toUpperCase() +
                listing.service_type.slice(1)
              : "service"}
          </h2>

          <div className="space-y-4 mb-6">
            <label className="block">
              <span className="text-zinc-300 text-sm font-medium mb-2 block">Start Date</span>
              <div className="relative group">
                <input
                  type="date"
                  className="w-full p-4 bg-zinc-900/90 rounded-xl border-2 border-zinc-700 hover:border-blue-500/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all text-white cursor-pointer shadow-sm hover:shadow-md"
                  value={startDate ?? ""}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              {startDate && (
                <p className="mt-2 text-sm text-blue-400 font-medium">
                  📅 {format(parseISO(startDate), "dd-MM-yyyy")}
                </p>
              )}
            </label>

            <label className="block">
              <span className="text-zinc-300 text-sm font-medium mb-2 block">End Date</span>
              <div className="relative group">
                <input
                  type="date"
                  className="w-full p-4 bg-zinc-900/90 rounded-xl border-2 border-zinc-700 hover:border-blue-500/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none transition-all text-white cursor-pointer shadow-sm hover:shadow-md"
                  value={endDate ?? ""}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || new Date().toISOString().split('T')[0]}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              {endDate && (
                <p className="mt-2 text-sm text-blue-400 font-medium">
                  📅 {format(parseISO(endDate), "dd-MM-yyyy")}
                </p>
              )}
            </label>
          </div>

          <div className="mt-6 p-5 bg-gradient-to-br from-zinc-900/90 to-zinc-800/90 border border-zinc-700 rounded-lg shadow-lg">
            <div className="space-y-2">
              <p className="text-zinc-300 text-sm">
                Price per {listing.unit}: <span className="text-white font-semibold">₹{listing.price_per_unit.toLocaleString("en-IN")}</span>
              </p>
              {listing.unit === "night" && (
                <p className="text-zinc-300 text-sm">
                  Nights selected: <span className="text-white font-semibold">{nights > 0 ? nights : "-"}</span>
                </p>
              )}
              {nights > 0 && listing.unit === "night" && (
                <div className="pt-3 border-t border-zinc-700">
                  <p className="text-xl font-bold text-green-400">
                    Total: ₹{(nights * listing.price_per_unit).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              if (!startDate || !endDate) {
                alert("Please select both start and end dates");
                return;
              }
              setShowBookingModal(true);
            }}
            className="w-full mt-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 p-3.5 rounded-lg font-bold text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02]"
          >
            Continue →
          </button>

          {/* 📌 REVIEW BUTTON */}
          <button
            onClick={() => router.push(`/search/${id}/review`)}
            className="w-full mt-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 p-3.5 rounded-lg font-bold text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span className="text-lg">⭐</span>
            <span>Leave a Review</span>
          </button>
        </div>

        {/* Seller info card (right side) */}
        <aside className="bg-[#050922]/80 border border-zinc-700 rounded-xl p-5 md:p-6">
          <h2 className="text-lg font-semibold mb-3">About the seller</h2>
          <p className="text-sm text-zinc-300 mb-4">
            Hosted by{" "}
            <span className="font-semibold text-white">
              {listing.owner_name || "ALT Partner"}
            </span>
          </p>

          <div className="space-y-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Member since</span>
              <span className="text-zinc-100">{sellerJoinedLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Listing type</span>
              <span className="text-zinc-100 capitalize">
                {listing.service_type || "service"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Location</span>
              <span className="text-zinc-100 text-right">
                {listing.address.city}, {listing.address.state}
              </span>
            </div>
          </div>

          <p className="mt-5 text-xs text-zinc-500 leading-relaxed">
            ALT keeps seller contact details private until a booking is
            confirmed. All hosts agree to our community and safety guidelines.
          </p>
        </aside>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setShowBookingModal(false)}
        >
          <div
            className="bg-[#07102a] border border-zinc-700 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Confirm Booking</h2>
              <button
                onClick={() => setShowBookingModal(false)}
                className="text-zinc-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">{listing.name}</h3>
                <p className="text-sm text-zinc-400 capitalize">
                  {listing.service_type} • {listing.category}
                </p>
              </div>

              <div className="border-t border-zinc-700 pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-zinc-300">Check-in</span>
                  <span className="text-white font-medium">
                    {startDate ? new Date(startDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }) : "-"}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-zinc-300">Check-out</span>
                  <span className="text-white font-medium">
                    {endDate ? new Date(endDate).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }) : "-"}
                  </span>
                </div>
                {listing.unit === "night" && (
                  <div className="flex justify-between mb-2">
                    <span className="text-zinc-300">Nights</span>
                    <span className="text-white font-medium">{nights}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-700 pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-zinc-300">
                    ₹{listing.price_per_unit.toLocaleString("en-IN")} × {nights} {listing.unit}
                    {nights !== 1 ? "s" : ""}
                  </span>
                  <span className="text-white">
                    ₹{(nights * listing.price_per_unit).toLocaleString("en-IN")}
                  </span>
                </div>
                {listing.discounts && listing.discounts.length > 0 && nights >= (listing.discounts[0]?.min_units || 0) && (
                  <div className="flex justify-between mb-2 text-green-400">
                    <span>Discount applied</span>
                    <span>
                      -₹{((nights * listing.price_per_unit) - totalPrice).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-zinc-700">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-xl font-bold text-green-400">
                    ₹{totalPrice.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 text-xl">🔒</span>
                <div>
                  <p className="text-emerald-300 font-semibold mb-1">Secure payment</p>
                  <p className="text-emerald-200/80 text-sm">
                    Pay with Razorpay (UPI QR, apps, cards). After you pay, close the Razorpay window if it does not
                    auto-close — we confirm your booking from Razorpay in the background (within a few seconds).
                  </p>
                </div>
              </div>
            </div>

            {bookingError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-300 text-sm">{bookingError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBookingModal(false);
                  setBookingError(null);
                }}
                disabled={savingBooking}
                className="flex-1 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                onClick={confirmBookingWithPayment}
                disabled={savingBooking}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingBooking ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
