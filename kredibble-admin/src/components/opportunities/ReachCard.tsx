"use client";

/**
 * ReachCard: how far a PUBLISHED listing travelled. Two blocks, Views and Applications. Each shows
 *   - the total (website + app) as a large number,
 *   - two MiniStats (Website, App),
 *   - a thin split bar and a text line with both shares ("Website 64% · App 36%").
 * The numbers are always in text; the bar is decoration (aria-hidden), so colour is never the only signal. A block with
 * a total of 0 shows an empty bar and "—" for the shares (a share of nothing is not 0%).
 * Structure idea from the 21st.dev "Stats Card" candidates (a metric with a mini visual); restyled to our tokens.
 *
 * Props:
 * - views, applications: { website, app }
 * - Test ids: reach-{views|applications}-{total|website|app}
 */
import { InfoCard } from "@/components/detail/InfoCard";
import { MiniStat } from "@/components/ui/MiniStat";

interface Split {
  website: number;
  app: number;
}

function ReachBlock({ id, label, split }: { id: "views" | "applications"; label: string; split: Split }) {
  const total = split.website + split.app;
  const share = (part: number) => (total > 0 ? Math.round((part / total) * 100) : undefined);
  const websiteShare = share(split.website);
  const appShare = share(split.app);

  return (
    <div data-testid={`reach-${id}`} className="min-w-0">
      <p className="caption">{label}</p>
      <p data-testid={`reach-${id}-total`} className="font-display text-3xl font-extrabold tabular-nums text-ink">
        {total.toLocaleString("en-US")}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div data-testid={`reach-${id}-website`}>
          <MiniStat value={split.website} label="Website" />
        </div>
        <div data-testid={`reach-${id}-app`}>
          <MiniStat value={split.app} label="App" />
        </div>
      </div>
      {/* The split bar: website in purple, app in orange (the brief's pair); decorative, the line below has the numbers. */}
      <div aria-hidden="true" className="mt-3 flex h-1.5 overflow-hidden rounded-pill bg-track">
        {total > 0 && (
          <>
            <div className="h-full bg-purple-500" style={{ width: `${(split.website / total) * 100}%` }} />
            <div className="h-full bg-orange-500" style={{ width: `${(split.app / total) * 100}%` }} />
          </>
        )}
      </div>
      <p data-testid={`reach-${id}-split`} className="caption mt-2">
        Website {websiteShare === undefined ? "—" : `${websiteShare}%`} · App {appShare === undefined ? "—" : `${appShare}%`}
      </p>
    </div>
  );
}

export function ReachCard({ views, applications }: { views: Split; applications: Split }) {
  return (
    <InfoCard title="Reach" subtitle="Where views and applications came from, on the website and in the app.">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <ReachBlock id="views" label="Views" split={views} />
        <ReachBlock id="applications" label="Applications" split={applications} />
      </div>
    </InfoCard>
  );
}
