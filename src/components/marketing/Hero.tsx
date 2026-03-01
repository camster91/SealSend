"use client";

import Link from "next/link";
import { ArrowRight, Play, Star, Users, Zap } from "lucide-react";
import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary-50 via-white to-white">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 h-[800px] w-[800px] rounded-full bg-primary-100/50 blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 h-[600px] w-[600px] rounded-full bg-accent-100/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <motion.div
          className="grid gap-12 lg:grid-cols-2 lg:gap-8"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Left content */}
          <div className="flex flex-col justify-center">
            {/* Badge */}
            <motion.div variants={fadeInUp}>
              <Link
                href="/pricing"
                className="group inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white px-4 py-1.5 text-sm font-medium text-primary-700 shadow-sm transition-all hover:border-primary-300 hover:shadow-md"
              >
                <Zap className="h-4 w-4 text-accent-500" />
                <span>Now in Beta — All features free!</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            {/* Heading */}
            <motion.h1
              variants={fadeInUp}
              className="mt-6 font-display text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl"
            >
              Create beautiful{" "}
              <span className="text-gradient">digital invitations</span> that
              wow your guests
            </motion.h1>

            {/* Subheading */}
            <motion.p
              variants={fadeInUp}
              className="mt-6 text-lg text-neutral-600 sm:text-xl"
            >
              Design stunning invitations, collect RSVPs instantly, and manage
              your event — all in one place. No design skills needed.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={fadeInUp}
              className="mt-8 flex flex-col gap-4 sm:flex-row"
            >
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-xl"
              >
                Create Your Invitation
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-neutral-200 bg-white px-8 py-4 text-lg font-semibold text-neutral-700 transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-neutral-50"
              >
                <Play className="h-5 w-5" />
                See How It Works
              </Link>
            </motion.div>

            {/* Social proof */}
            <motion.div variants={fadeInUp} className="mt-10">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-10 w-10 rounded-full border-2 border-white bg-gradient-to-br from-primary-300 to-primary-500 shadow-sm"
                      style={{
                        backgroundImage: `url(https://i.pravatar.cc/100?img=${i + 20})`,
                        backgroundSize: "cover",
                      }}
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className="h-4 w-4 fill-accent-400 text-accent-400"
                      />
                    ))}
                  </div>
                  <p className="text-sm text-neutral-600">
                    <span className="font-semibold text-neutral-900">
                      2,000+
                    </span>{" "}
                    events created this month
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right content - Hero image/mockup */}
          <motion.div
            variants={fadeInUp}
            className="relative flex items-center justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-lg">
              {/* Main card */}
              <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="aspect-[4/5] bg-gradient-to-br from-primary-100 to-accent-100 p-6">
                  {/* Mock invitation preview */}
                  <div className="h-full rounded-xl bg-white p-6 shadow-lg">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                      <div className="h-8 w-24 rounded bg-primary-100" />
                      <div className="h-8 w-8 rounded-full bg-accent-100" />
                    </div>
                    <div className="mt-6 space-y-4">
                      <div className="h-32 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50" />
                      <div className="h-8 w-3/4 rounded bg-neutral-100" />
                      <div className="h-4 w-full rounded bg-neutral-50" />
                      <div className="h-4 w-2/3 rounded bg-neutral-50" />
                    </div>
                    <div className="mt-8 flex gap-3">
                      <div className="h-10 flex-1 rounded-lg bg-primary-600" />
                      <div className="h-10 flex-1 rounded-lg border-2 border-neutral-200" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating elements */}
              <motion.div
                className="absolute -left-8 top-1/4 rounded-xl bg-white p-4 shadow-xl"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-100">
                    <Users className="h-5 w-5 text-success-600" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">RSVP Received</p>
                    <p className="font-semibold text-neutral-900">Sarah + 2</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -right-4 bottom-1/4 rounded-xl bg-white p-4 shadow-xl"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100">
                    <Star className="h-4 w-4 text-accent-600" />
                  </div>
                  <p className="text-sm font-medium text-neutral-900">
                    42 guests attending!
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
