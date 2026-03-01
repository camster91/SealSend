"use client";

import { FEATURES_LIST } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Palette,
  Mail,
  BarChart3,
  Globe,
  Smartphone,
  Lock,
  Users,
  Sparkles,
  CalendarCheck,
  Gift,
  Image,
  Share2,
  type LucideIcon,
} from "lucide-react";

// Map icon components from constants
const iconComponents = {
  Palette,
  Mail,
  BarChart3,
  Globe,
  Smartphone,
  Lock,
  Users,
  Sparkles,
  CalendarCheck,
  Gift,
  Image,
  Share2,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export default function FeaturesGrid() {
  return (
    <section id="features" className="bg-neutral-900 px-4 py-24 text-white">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center rounded-full bg-primary-500/20 px-4 py-1.5 text-sm font-medium text-primary-300">
            Features
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Everything you need for your event
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-400">
            From design to delivery, we&apos;ve got you covered with powerful tools
            that make event planning a breeze.
          </p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {FEATURES_LIST.map((feature, idx) => {
            const Icon = (iconComponents as Record<string, React.ComponentType<{className?: string}>>)[feature.icon as unknown as string] ?? Sparkles;

            return (
              <motion.div
                key={idx}
                variants={itemVariants}
                className={cn(
                  "group relative rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300",
                  "hover:-translate-y-1 hover:border-primary-500/30 hover:bg-white/10"
                )}
              >
                {/* Icon */}
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/20 transition-colors group-hover:bg-primary-500/30">
                  <Icon className="h-6 w-6 text-primary-400" />
                </div>

                {/* Content */}
                {feature.subtitle && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary-400">
                    {feature.subtitle}
                  </p>
                )}
                <h3 className="font-display text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {feature.description}
                </p>

                {/* Hover effect decoration */}
                <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary-500/0 to-primary-500/0 transition-all group-hover:from-primary-500/5 group-hover:to-accent-500/5" />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-neutral-400">
            And much more...{" "}
            <a
              href="/signup"
              className="font-medium text-primary-400 hover:text-primary-300"
            >
              Try it free →
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
