"use client";

import { motion, Variants } from "framer-motion";
import Link from "next/link";

// Properly typed variants
const letterVariants: Variants = {
  hiddenLeft: { opacity: 0, x: -120 },
  hiddenBottom: { opacity: 0, y: 120 },
  hiddenRight: { opacity: 0, x: 120 },

  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      delay: 0.2 + i * 0.15,
      duration: 0.7,
      ease: "easeInOut",
    },
  }),
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#0b1027_0%,#050316_45%,black_100%)] text-white flex flex-col">

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 pt-16 md:pt-24 pb-16 flex flex-col items-center text-center">

          {/* ALT LOGO */}
          <div className="relative mb-6 md:mb-8">
            <div className="flex gap-4 md:gap-6 items-end justify-center">

              <motion.span
                custom={0}
                initial="hiddenLeft"
                animate="visible"
                variants={letterVariants}
                className="text-6xl md:text-7xl lg:text-8xl font-extrabold drop-shadow-[0_0_35px_rgba(56,189,248,0.9)]"
              >
                A
              </motion.span>

              <motion.span
                custom={1}
                initial="hiddenBottom"
                animate="visible"
                variants={letterVariants}
                className="text-6xl md:text-7xl lg:text-8xl font-extrabold drop-shadow-[0_0_35px_rgba(52,211,153,0.9)]"
              >
                L
              </motion.span>

              <motion.span
                custom={2}
                initial="hiddenRight"
                animate="visible"
                variants={letterVariants}
                className="text-6xl md:text-7xl lg:text-8xl font-extrabold drop-shadow-[0_0_35px_rgba(251,191,36,0.9)]"
              >
                T
              </motion.span>

            </div>

            <div className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-70">
              <div className="w-40 h-40 md:w-60 md:h-60 bg-[radial-gradient(circle,rgba(59,130,246,0.7)_0%,transparent_60%)] mx-auto" />
            </div>
          </div>

          {/* TAGLINE */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.95, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="text-lg md:text-2xl text-zinc-200 mb-3 md:mb-4"
          >
            <span className="block mb-1 text-zinc-300">The future of booking.</span>
          </motion.p>

          {/* CTA */}
          <Link href="/search">
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="mt-4 inline-flex items-center gap-2 px-6 md:px-8 py-2.5 md:py-3 rounded-full bg-linear-to-r from-sky-500 via-emerald-400 to-amber-300 text-white font-semibold text-sm md:text-base shadow-lg hover:shadow-xl transition"
            >
              Book your experience <span className="text-lg">↗️</span>
            </motion.button>
          </Link>

          {/* Subtext */}
          <p className="mt-4 max-w-xl text-xs md:text-sm text-zinc-400">
            Discover services like venues, decorators, caterers, DJs and photographers on one seamless platform.
          </p>

          {/* Scroll indicator */}
          <div className="mt-12 flex flex-col items-center gap-2 text-xs text-zinc-500">
            <span>Scroll to see what’s new</span>
            <div className="w-px h-10 bg-linear-to-b from-zinc-500/60 to-transparent relative overflow-hidden">
              <motion.div
                className="absolute inset-x-0 top-0 h-6 bg-linear-to-b from-white/70 to-transparent"
                animate={{ y: [0, 32] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
              />
            </div>
          </div>

        </section>

        {/* ABOUT (merged from /about) */}
        <section id="about">
          <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="text-5xl md:text-6xl font-extrabold mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-emerald-300 to-amber-300">
                  About ALT
                </span>
              </h2>
              <p className="text-xl text-zinc-300 max-w-2xl mx-auto">
                The future of booking. One platform for all your event needs.
              </p>
            </motion.div>

            {/* Mission Section */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-16"
            >
              <h3 className="text-3xl font-bold mb-6 text-sky-400">Our Mission</h3>
              <p className="text-lg text-zinc-300 leading-relaxed mb-4">
                ALT was born from a simple idea: booking event services shouldn't be complicated.
                We've created a seamless platform that connects you with the best services—venues, decorators,
                caterers, DJs, and photographers—all in one place.
              </p>
              <p className="text-lg text-zinc-300 leading-relaxed">
                Whether you're planning a wedding, corporate event, birthday celebration, or any
                special occasion, ALT makes it easy to discover, compare, and book the perfect
                services for your event.
              </p>
            </motion.section>

            {/* What We Offer */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-16"
            >
              <h3 className="text-3xl font-bold mb-6 text-emerald-400">What We Offer</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3 text-sky-300">For Event Organizers</h4>
                  <ul className="space-y-2 text-zinc-300">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Browse thousands of verified service providers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Advanced filtering by location, price, ratings, and availability</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Read authentic reviews from past customers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Secure booking and payment processing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Manage all your bookings in one place</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6">
                  <h4 className="text-xl font-semibold mb-3 text-amber-300">For Service Providers</h4>
                  <ul className="space-y-2 text-zinc-300">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>List your services for free</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Showcase your work with photos and detailed descriptions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Set your own pricing and availability</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Receive bookings from verified customers</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">✓</span>
                      <span>Build your reputation through customer reviews</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.section>

            {/* Services */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mb-16"
            >
              <h3 className="text-3xl font-bold mb-6 text-amber-400">Our Services</h3>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { name: "Services", desc: "Venues, farmhouses, villas, banquet halls, studios & more" },
                  { name: "Decorators", desc: "Floral, Luxury, Minimal, Boho & Theme-based designs" },
                  { name: "Caterers", desc: "Indian, Continental, Italian, Asian Fusion & Custom menus" },
                  { name: "DJs", desc: "Bollywood, EDM, House, Hip-Hop & Mixed genres" },
                  { name: "Photographers", desc: "Candid, Cinematic, Drone, Fashion & Event coverage" },
                ].map((service, index) => (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.4, delay: 0.1 + index * 0.08 }}
                    className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 transition-colors"
                  >
                    <h4 className="text-lg font-semibold mb-2 text-white">{service.name}</h4>
                    <p className="text-sm text-zinc-400">{service.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            {/* Why Choose ALT */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-16"
            >
              <h3 className="text-3xl font-bold mb-6 text-sky-400">Why Choose ALT?</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-semibold mb-2">Comprehensive Search</h4>
                  <p className="text-zinc-300">
                    Find exactly what you're looking for with our advanced filtering system.
                    Filter by location, price range, ratings, availability dates, and more.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold mb-2">Verified Reviews</h4>
                  <p className="text-zinc-300">
                    Make informed decisions with authentic reviews and ratings from real customers
                    who have used these services.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold mb-2">Secure & Reliable</h4>
                  <p className="text-zinc-300">
                    Your data and payments are protected with industry-standard security measures.
                    Book with confidence.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold mb-2">Easy Booking Process</h4>
                  <p className="text-zinc-300">
                    From discovery to booking, our streamlined process makes planning your event
                    simple and stress-free.
                  </p>
                </div>
              </div>
            </motion.section>

            {/* CTA */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-center bg-gradient-to-r from-sky-900/30 via-emerald-900/30 to-amber-900/30 border border-zinc-800 rounded-xl p-8 md:p-12"
            >
              <h3 className="text-3xl font-bold mb-4">Ready to Get Started?</h3>
              <p className="text-lg text-zinc-300 mb-8 max-w-2xl mx-auto">
                Whether you're planning an event or offering services, ALT is here to help you
                succeed. Join thousands of satisfied users today.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/search"
                  className="px-6 py-3 bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-300 text-black font-semibold rounded-full hover:shadow-lg transition"
                >
                  Browse Services
                </Link>
                <Link
                  href="/add-venue"
                  className="px-6 py-3 bg-zinc-800 border border-zinc-700 text-white font-semibold rounded-full hover:bg-zinc-700 transition"
                >
                  List Your Service
                </Link>
              </div>
            </motion.section>
          </div>
        </section>

      </main>

    </div>
  );
}