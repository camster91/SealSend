'use client';

interface UsageStatsProps {
  tier: string;
  eventsUsed: number;
  eventsLimit: number;
  guestsUsed: number;
  guestsLimit: number;
}

export function UsageStats({ tier, eventsUsed, eventsLimit, guestsUsed, guestsLimit }: UsageStatsProps) {
  const isUnlimited = (limit: number) => limit === -1;
  const eventsPercent = isUnlimited(eventsLimit) ? 0 : Math.min((eventsUsed / eventsLimit) * 100, 100);
  const guestsPercent = isUnlimited(guestsLimit) ? 0 : Math.min((guestsUsed / guestsLimit) * 100, 100);

  const tierColors: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    pro: 'bg-brand-100 text-brand-700',
    business: 'bg-amber-100 text-amber-700',
    'SealSend Pro': 'bg-brand-100 text-brand-700',
    'Controlled Beta': 'bg-emerald-100 text-emerald-700',
    'Business (Beta)': 'bg-emerald-100 text-emerald-700',
  };

  const badgeClass = tierColors[tier] || tierColors.free;

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-500">Plan Usage</h3>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
            {tier.charAt(0).toUpperCase() + tier.slice(1)}
          </span>
        </div>

        {/* Events usage */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Events</span>
            <span className="font-medium text-gray-900">
              {eventsUsed} / {isUnlimited(eventsLimit) ? '∞' : eventsLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${eventsPercent > 90 ? 'bg-red-500' : eventsPercent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: isUnlimited(eventsLimit) ? '5%' : `${eventsPercent}%` }}
            />
          </div>
        </div>

        {/* Guests usage */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Guests</span>
            <span className="font-medium text-gray-900">
              {guestsUsed} / {isUnlimited(guestsLimit) ? '∞' : guestsLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${guestsPercent > 90 ? 'bg-red-500' : guestsPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: isUnlimited(guestsLimit) ? '5%' : `${guestsPercent}%` }}
            />
          </div>
        </div>

        {/* Upgrade CTA */}
        {tier === 'free' && (
          <a
            href="/pricing"
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Upgrade Plan
          </a>
        )}
      </div>
    </div>
  );
}
