"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Shield, Clock } from "lucide-react";
import { BETA_MODE } from "@/lib/constants";

export function PricingCTA() {
  return (
    <section className="gradient-brand px-4 py-20 text-white">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          {BETA_MODE
            ? "Ready to create your first invitation?"
            : "Ready to get started?"}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-white/80">
          {BETA_MODE
            ? "Join thousands of hosts using SealSend during our beta. All features are free!"
            : "Join thousands of happy hosts creating beautiful invitations and managing their events with ease."}
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
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-lg font-semibold text-primary-600 shadow-lg transition-all hover:bg-primary-50 hover:shadow-xl"
          >
            {BETA_MODE ? "Get Started Free" : "Start Free Trial"}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10"
          >
            See How It Works
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
                  backgroundImage: `url(https://i.pravatar.cc/100?img=${i + 10})`,
                  backgroundSize: "cover",
                }}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-white/80">
            <span className="font-semibold text-white">2,000+</span> events created this month
          </p>
        </div>
      </div>
    </section>
  );
}
