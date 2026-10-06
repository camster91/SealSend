import { MapPin } from "lucide-react";

interface LocationMapProps {
  address: string;
  name?: string;
}

// Address card with a directions link. There is deliberately no embedded map:
// an embed needs coordinates (we only store the address) and a CSP frame-src
// exception for a third party that would then see every guest's visit.
export function LocationMap({ address, name }: LocationMapProps) {
  const query = encodeURIComponent(name ? `${name}, ${address}` : address);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-white p-4 text-sm text-muted-foreground">
      <div className="flex min-w-0 items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="min-w-0">
          {name && <p className="font-medium text-foreground">{name}</p>}
          <p className="break-words">{address}</p>
        </div>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700"
      >
        Get Directions
      </a>
    </div>
  );
}
