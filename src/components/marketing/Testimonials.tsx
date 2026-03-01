"use client";

import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";

const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "Bride",
    event: "Wedding",
    quote:
      "SealSend made our wedding invitations absolutely magical. The RSVP tracking saved us so much time, and our guests loved the beautiful design!",
    rating: 5,
    image: "https://i.pravatar.cc/150?img=5",
  },
  {
    name: "David Chen",
    role: "Event Planner",
    event: "Corporate Gala",
    quote:
      "I use SealSend for all my corporate events. The guest management features are incredible, and my clients are always impressed with the results.",
    rating: 5,
    image: "https://i.pravatar.cc/150?img=11",
  },
  {
    name: "Emily Rodriguez",
    role: "Mom-to-be",
    event: "Baby Shower",
    quote:
      "So easy to use! I created my baby shower invitation in minutes and tracking RSVPs was a breeze. Highly recommend!",
    rating: 5,
    image: "https://i.pravatar.cc/150?img=9",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
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

export default function Testimonials() {
  return (
    <section className="bg-primary-50/50 px-4 py-24">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-flex items-center rounded-full bg-primary-100 px-4 py-1.5 text-sm font-medium text-primary-700">
            Testimonials
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl">
            Loved by hosts everywhere
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600">
            See what our users are saying about their experience with SealSend.
          </p>
        </motion.div>

        {/* Testimonials grid */}
        <motion.div
          className="grid gap-8 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {testimonials.map((testimonial, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className="relative rounded-2xl bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Quote icon */}
              <div className="absolute -top-4 left-8 flex h-8 w-8 items-center justify-center rounded-full bg-primary-100">
                <Quote className="h-4 w-4 text-primary-600" />
              </div>

              {/* Rating */}
              <div className="mb-4 flex gap-1">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 fill-accent-400 text-accent-400"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="mb-6 text-neutral-700 leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-neutral-900">
                    {testimonial.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {testimonial.role} • {testimonial.event}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust badges */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex flex-wrap items-center justify-center gap-8">
            {[
              { value: "10K+", label: "Events Created" },
              { value: "500K+", label: "Guests Invited" },
              { value: "4.9/5", label: "Average Rating" },
              { value: "99%", label: "Satisfaction" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-3xl font-bold text-primary-600">
                  {stat.value}
                </p>
                <p className="text-sm text-neutral-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
