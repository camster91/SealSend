"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { marketingSignupHref, type MarketingChannel } from "@/lib/analytics/marketing-attribution";

const ChannelContext = createContext<MarketingChannel>("direct");
export const MarketingAttributionProvider = ChannelContext.Provider;
export function useMarketingChannel() { return useContext(ChannelContext); }
export function MarketingSignupLink({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Link href={marketingSignupHref(useMarketingChannel())} className={className}>{children}</Link>;
}
