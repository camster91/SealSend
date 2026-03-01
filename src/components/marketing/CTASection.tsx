"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Shield, Clock, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { BETA_MODE } from "@/lib/constants";

export default function CTASection() {
  return (
    <section className="relative overflow-hidden gradient-brand px-4 py-24 text-white">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute left-0 top-0 h-full w-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
      </div>

      <div className="relative mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <Heart className="h-4 w-4 text-accent-300" />
            <span>Join 10,000+ happy hosts</span>
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {BETA_MODE
              ? "Ready to create something beautiful?"
              : "Ready to make your event unforgettable?"}
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
            {BETA_MODE
              ? "Join our beta and create stunning invitations for free. Help us shape the future of digital invitations."
              : "Start creating beautiful invitations today. No design skills needed, no credit card required to start."}
          </p>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-white/70">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span>Free to start</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Set up in 2 minutes</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-semibold text-primary-600 shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:bg-primary-50 hover:shadow-xl"
            >
              {BETA_MODE ? "Get Started Free" : "Start Free Trial"}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 text-lg font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10"
            >
              View Pricing
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12">
            <div className="flex items-center justify-center -space-x-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-10 w-10 rounded-full border-2 border-white bg-gradient-to-br from-primary-300 to-primary-500"
                  style={{
                    backgroundImage: `url(https://i.pravatar.cc/100?img=${i + 30})`,
                    backgroundSize: "cover",
                  }}
                />
              ))}
            </div>
            <p className="mt-4 text-sm text-white/80">
              <span className="font-semibold text-white">2,000+</span> events
              created this month
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
