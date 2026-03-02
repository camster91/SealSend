"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, BarChart3, Users, Utensils, Clock, MessageSquare } from "lucide-react";
import type { RSVPResponse } from "@/types/database";

// Simple pie chart component using SVG
function PieChart({ data, colors, size = 160 }: { data: number[]; colors: string[]; size?: number }) {
  const total = data.reduce((sum, val) => sum + val, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-sm text-muted-foreground">No data</div>
      </div>
    );
  }

  const radius = size / 2 - 10;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((value, i) => {
        if (value === 0) return null;
        const segmentLength = (value / total) * circumference;
        const currentOffset = offset;
        offset += segmentLength;
        return (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth={radius * 0.8}
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-currentOffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
      })}
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-xl font-bold"
      >
        {total}
      </text>
    </svg>
  );
}

// Progress bar component
function ProgressBar({ value, max, color = "bg-brand-500", label }: { value: number; max: number; color?: string; label?: string }) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value}</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ title, value, subtitle, icon: Icon, color }: { 
  title: string; 
  value: number | string; 
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [responses, setResponses] = useState<RSVPResponse[]>([]);
  const [guestCount, setGuestCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch responses
      const res = await fetch(`/api/events/${eventId}/responses`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data);
      }

      // Fetch guest count
      const guestRes = await fetch(`/api/events/${eventId}/guests`);
      if (guestRes.ok) {
        const guests = await guestRes.json();
        setGuestCount(guests.length);
      }
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate stats
  const totalResponses = responses.length;
  const attending = responses.filter((r) => r.status === "attending").length;
  const notAttending = responses.filter((r) => r.status === "not_attending").length;
  const maybe = responses.filter((r) => r.status === "maybe").length;
  const pending = responses.filter((r) => r.status === "pending").length;

  // Response rate
  const responseRate = guestCount > 0 ? Math.round((totalResponses / guestCount) * 100) : 0;

  // Total headcount (from attending responses)
  const totalHeadcount = responses
    .filter((r) => r.status === "attending")
    .reduce((sum, r) => sum + (r.headcount || 1), 0);

  // Dietary restrictions breakdown
  const dietaryRestrictions: Record<string, number> = {};
  responses.forEach((r) => {
    const dietary = r.response_data?.dietary_restrictions || r.response_data?.dietary;
    if (dietary && typeof dietary === "string" && dietary.trim()) {
      const key = dietary.trim();
      dietaryRestrictions[key] = (dietaryRestrictions[key] || 0) + 1;
    }
  });

  // Common dietary restriction keywords
  const commonDietary = ["vegetarian", "vegan", "gluten-free", "gluten free", "dairy-free", "dairy free", "nut-free", "nut free", "kosher", "halal"];
  const categorizedDietary: Record<string, number> = {};
  
  responses.forEach((r) => {
    const dietary = r.response_data?.dietary_restrictions || r.response_data?.dietary;
    if (dietary && typeof dietary === "string") {
      const lowerDietary = dietary.toLowerCase();
      let matched = false;
      
      for (const keyword of commonDietary) {
        if (lowerDietary.includes(keyword)) {
          const normalized = keyword.replace("-", " ");
          categorizedDietary[normalized] = (categorizedDietary[normalized] || 0) + 1;
          matched = true;
        }
      }
      
      if (!matched && dietary.trim()) {
        categorizedDietary["Other"] = (categorizedDietary["Other"] || 0) + 1;
      }
    }
  });

  // Custom question responses
  const customQuestions: Record<string, Record<string, number>> = {};
  responses.forEach((r) => {
    Object.entries(r.response_data || {}).forEach(([key, value]) => {
      // Skip common fields
      if (["adult_count", "child_count", "dietary", "dietary_restrictions", "message", "notes"].includes(key)) return;
      
      if (!customQuestions[key]) {
        customQuestions[key] = {};
      }
      
      const strValue = String(value);
      customQuestions[key][strValue] = (customQuestions[key][strValue] || 0) + 1;
    });
  });

  // Timeline of RSVPs (group by date)
  const timeline: Record<string, number> = {};
  const sortedResponses = [...responses].sort((a, b) => 
    new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );
  
  sortedResponses.forEach((r) => {
    const date = new Date(r.submitted_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    timeline[date] = (timeline[date] || 0) + 1;
  });

  // Cumulative timeline data
  const timelineDates = Object.keys(timeline);
  const timelineValues = Object.values(timeline);
  let cumulative = 0;
  const cumulativeTimeline = timelineValues.map((val) => {
    cumulative += val;
    return cumulative;
  });

  // Colors for charts
  const statusColors = ["#22c55e", "#ef4444", "#f59e0b", "#6b7280"];
  const dietaryColors = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#6366f1", "#84cc16"];

  if (loading) {
    return (
      <div className="py-6">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/events/${eventId}`}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to event
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">RSVP Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Insights and statistics for your event
              </p>
            </div>
            <Button variant="outline" onClick={fetchData}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Guests"
            value={guestCount}
            subtitle={`${totalHeadcount} attending`}
            icon={Users}
            color="bg-blue-500"
          />
          <StatCard
            title="Attending"
            value={attending}
            subtitle={totalResponses > 0 ? `${Math.round((attending / totalResponses) * 100)}% of responses` : "0%"}
            icon={BarChart3}
            color="bg-green-500"
          />
          <StatCard
            title="Not Attending"
            value={notAttending}
            subtitle={totalResponses > 0 ? `${Math.round((notAttending / totalResponses) * 100)}% of responses` : "0%"}
            icon={BarChart3}
            color="bg-red-500"
          />
          <StatCard
            title="Maybe"
            value={maybe}
            subtitle={totalResponses > 0 ? `${Math.round((maybe / totalResponses) * 100)}% of responses` : "0%"}
            icon={BarChart3}
            color="bg-amber-500"
          />
        </div>

        {/* Response Rate */}
        <div className="mb-6 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Response Rate</h2>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <ProgressBar
                value={responseRate}
                max={100}
                color={responseRate >= 75 ? "bg-green-500" : responseRate >= 50 ? "bg-amber-500" : "bg-red-500"}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                {totalResponses} of {guestCount} guests have responded ({responseRate}%)
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold">{responseRate}%</div>
              <div className="text-sm text-muted-foreground">Response Rate</div>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Status Breakdown */}
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-brand-500" />
              Response Status
            </h2>
            <div className="flex items-center gap-6">
              <PieChart
                data={[attending, notAttending, maybe, pending]}
                colors={statusColors}
                size={140}
              />
              <div className="flex-1 space-y-3">
                <ProgressBar
                  value={attending}
                  max={totalResponses || 1}
                  color="bg-green-500"
                  label={`Attending (${attending})`}
                />
                <ProgressBar
                  value={notAttending}
                  max={totalResponses || 1}
                  color="bg-red-500"
                  label={`Not Attending (${notAttending})`}
                />
                <ProgressBar
                  value={maybe}
                  max={totalResponses || 1}
                  color="bg-amber-500"
                  label={`Maybe (${maybe})`}
                />
                {pending > 0 && (
                  <ProgressBar
                    value={pending}
                    max={totalResponses || 1}
                    color="bg-gray-400"
                    label={`Pending (${pending})`}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Dietary Restrictions */}
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Utensils className="h-5 w-5 text-brand-500" />
              Dietary Restrictions
            </h2>
            {Object.keys(categorizedDietary).length > 0 ? (
              <div className="flex items-center gap-6">
                <PieChart
                  data={Object.values(categorizedDietary)}
                  colors={dietaryColors}
                  size={140}
                />
                <div className="flex-1 space-y-2">
                  {Object.entries(categorizedDietary)
                    .sort(([, a], [, b]) => b - a)
                    .map(([restriction, count], i) => (
                      <div key={restriction} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: dietaryColors[i % dietaryColors.length] }}
                          />
                          <span className="text-sm capitalize">{restriction}</span>
                        </div>
                        <span className="text-sm font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No dietary restrictions reported
              </div>
            )}
          </div>
        </div>

        {/* Custom Questions */}
        {Object.keys(customQuestions).length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <MessageSquare className="h-5 w-5 text-brand-500" />
              Custom Question Responses
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(customQuestions).map(([question, answers]) => {
                const total = Object.values(answers).reduce((sum, val) => sum + val, 0);
                return (
                  <div key={question} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                    <h3 className="mb-3 text-sm font-medium capitalize">
                      {question.replace(/_/g, " ")}
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(answers)
                        .sort(([, a], [, b]) => b - a)
                        .map(([answer, count]) => (
                          <ProgressBar
                            key={answer}
                            value={count}
                            max={total}
                            label={`${answer} (${count})`}
                          />
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timeline */}
        {timelineDates.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Clock className="h-5 w-5 text-brand-500" />
              RSVP Timeline
            </h2>
            <div className="space-y-4">
              <div className="flex items-end gap-1 h-32">
                {timelineValues.map((count, i) => {
                  const maxCount = Math.max(...timelineValues);
                  const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className="w-full rounded-t bg-brand-500 transition-all duration-500"
                        style={{ height: `${height}%`, minHeight: count > 0 ? "4px" : "0" }}
                        title={`${timelineDates[i]}: ${count} response${count !== 1 ? "s" : ""}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{timelineDates[0]}</span>
                <span>{timelineDates[timelineDates.length - 1]}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div>
                  <p className="text-sm text-muted-foreground">First RSVP</p>
                  <p className="text-lg font-semibold">
                    {sortedResponses[0] 
                      ? new Date(sortedResponses[0].submitted_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Latest RSVP</p>
                  <p className="text-lg font-semibold">
                    {sortedResponses[sortedResponses.length - 1]
                      ? new Date(sortedResponses[sortedResponses.length - 1].submitted_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {totalResponses === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No responses yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Analytics will appear here once guests start responding to your event.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
