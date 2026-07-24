"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  shape: "circle" | "square";
}

const COLORS = [
  "#7c3aed", "#ec4899", "#3b82f6", "#f59e0b",
  "#10b981", "#6366f1", "#f43f5e", "#8b5cf6",
];

const PARTICLE_COUNT = 24;

export function ConfettiEffect() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Respect reduced motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShow(false);
      return;
    }

    const newParticles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 6,
        delay: Math.random() * 1.2,
        duration: 2.5 + Math.random() * 2,
        shape: Math.random() > 0.5 ? "circle" : "square",
      });
    }
    setParticles(newParticles);

    const timer = setTimeout(() => setShow(false), 4500);
    return () => clearTimeout(timer);
  }, []);

  if (!show || particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
