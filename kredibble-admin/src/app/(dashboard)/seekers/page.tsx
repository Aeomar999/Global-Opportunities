"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { getSeekers, SeekerProfile, Paginated } from "@/lib/api";

interface ExtendedSeekerProfile extends SeekerProfile {
  applicationsCount?: number;
  savedCount?: number;
}

export default function SeekersDirectoryPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [data, setData] = useState<Paginated<SeekerProfile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeekers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSeekers({ page, limit, q: query || undefined });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load seekers");
    } finally {
      setLoading(false);
    }
  }, [page, limit, query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSeekers();
  }, [fetchSeekers]);

  const seekers = data?.data || [];
  const totalPages = data?.meta?.pages || 0;
  const total = data?.meta?.total || 0;

  return (
    <div>
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Seekers Directory</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        {total} seeker accounts registered on the platform.
      </p>

      <div className="relative mb-5 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kb-text-placeholder" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, email, profession..."
          className="w-full h-10 rounded-lg border border-kb-border-input bg-kb-bg-card pl-9 pr-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-kb-primary" />
          <span className="ml-2 text-sm text-kb-text-muted">Loading seekers...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-center">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load seekers</p>
            <p className="text-xs text-kb-text-muted mt-1">{error}</p>
            <button
              onClick={() => { setPage(1); }}
              className="mt-3 text-sm text-kb-primary hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-kb-bg-card border border-kb-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1.6fr_1.6fr_1fr_0.8fr_0.8fr_1fr_20px] gap-4 px-5 py-3 border-b border-kb-border text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder">
            <span>Name</span>
            <span>University</span>
            <span>Country</span>
            <span>Applied</span>
            <span>Saved</span>
            <span>Status</span>
            <span />
          </div>

          {data?.data.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-kb-text-muted">
              {query ? "No seekers match your search." : "No seekers found."}
            </div>
          ) : (
            <>
              {data?.data.map((seeker) => (
                <Link
                  key={seeker.id}
                  href={`/seekers/${seeker.id}`}
                  className="grid grid-cols-[1.6fr_1.6fr_1fr_0.8fr_0.8fr_1fr_20px] gap-4 px-5 py-4 items-center border-b border-kb-border last:border-b-0 hover:bg-kb-bg-alt transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-kb-text-body truncate">{seeker.fullName || seeker.name}</p>
                    <p className="text-xs text-kb-text-muted mt-0.5 truncate">{seeker.email}</p>
                  </div>
                  <span className="text-sm text-kb-text-muted min-w-0 truncate" title={seeker.profession}>
                    {seeker.profession || "—"}
                  </span>
                  <span className="text-sm text-kb-text-muted truncate">{seeker.country || "—"}</span>
                  <span className="text-sm text-kb-text-muted">{(seeker as ExtendedSeekerProfile).applicationsCount || 0}</span>
                  <span className="text-sm text-kb-text-muted">{(seeker as ExtendedSeekerProfile).savedCount || 0}</span>
                  <span
                    className="inline-flex w-fit text-xs font-semibold rounded-full px-2.5 py-1"
                    style={
                      seeker.verified
                        ? { backgroundColor: "#F0FDF4", color: "#16A34A" }
                        : { backgroundColor: "#FEF2F2", color: "#ED4C5C" }
                    }
                  >
                    {seeker.verified ? "Verified" : "Pending"}
                  </span>
                  <ChevronRight size={18} className="text-kb-text-placeholder justify-self-end" />
                </Link>
              ))}

              {seekers.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-kb-border">
                  <span className="text-sm text-kb-text-muted">
                    Page {page} of {totalPages} ({total} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 text-sm border border-kb-border rounded-lg hover:bg-kb-bg-alt disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="px-3 py-1 text-sm border border-kb-border rounded-lg hover:bg-kb-bg-alt disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}