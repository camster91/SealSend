"use client";

import { ClipboardCheck, FileText, ListChecks, ScanLine } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    icon: FileText,
    step: "01",
    title: "Start from the event brief",
    description:
      "Turn the event details into an editable invitation, RSVP questions, and initial guest workflow.",
    color: "from-primary-500 to-primary-600",
  },
  {
    icon: ClipboardCheck,
    step: "02",
    title: "Review the invitation and RSVP",
    description:
      "Approve every generated detail before publishing. Nothing is sent to guests automatically.",
    color: "from-accent-500 to-accent-600",
  },
  {
    icon: ListChecks,
    step: "03",
    title: "Act on the guest list",
    description:
      "Organize guests, plus-ones, tags, responses, and host-approved updates from one working list.",
    color: "from-success-500 to-success-600",
  },
  {
    icon: ScanLine,
    step: "04",
    title: "Run event day",
    description:
      "Give co-hosts the information they need and use the check-in view to keep arrival status current.",
    color: "from-purple-500 to-purple-600",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white px-4 py-24">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center rounded-full bg-accent-100 px-4 py-1.5 text-sm font-medium text-accent-700">
            How It Works
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
            One approved workflow from brief to check-in
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600">
            SealSend keeps the invitation, guest decisions, communications,
            and event-day status connected without taking control away from the host.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          className="relative"
          variants={containerVariants}
          initial="visible"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Connection line (desktop) */}
          <div className="absolute left-1/2 top-24 hidden h-1 w-3/4 -translate-x-1/2 lg:block">
            <div className="h-full w-full rounded-full bg-neutral-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 via-accent-500 to-success-500"
                initial={{ width: "0%" }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-4">
            {steps.map((step, _idx) => {
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.step}
                  variants={itemVariants}
                  className="relative text-center"
                >
                  {/* Step number and icon */}
                  <div className="relative mx-auto mb-6 inline-block">
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} shadow-lg`}
                    >
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-neutral-900 shadow-md">
                      {step.step}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-xl font-semibold text-neutral-900">
                    {step.title}
                  </h3>
                  <p className="mx-auto mt-2 max-w-xs text-neutral-600">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
