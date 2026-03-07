"use client";

import { useMemo } from "react";
import {
    X, FileText, Users, TrendingUp, TrendingDown, Minus, AlertTriangle,
    Bell, BookOpen, BarChart3, GitBranch, Shield,
} from "lucide-react";
import { formatRelative } from "@/lib/utils";

interface EntityProfile {
    name: string;
    type: string;
    mentions: number;
    influence: number;
    relevance_score?: number;
    relevance_reason?: string;
    connected_stories?: Array<{
        theme: string;
        article_count: number;
        sentiment: string;
        sample_title: string;
    }>;
    sentiment: Record<string, number | string>;
    risk_tags: string[];
    relationships: Array<{ entity_name: string; strength: number }>;
    first_seen: string;
    last_seen: string;
}

const TYPE_ICONS: Record<string, string> = {
    person: "👤",
    org: "🏢",
    organization: "🏢",
    location: "📍",
    government: "🏛️",
    media: "📰",
    regulation: "⚖️",
    product: "📦",
};

const SENT_DOT: Record<string, string> = {
    positive: "bg-emerald",
    negative: "bg-rose",
    neutral: "bg-text-muted",
    mixed: "bg-amber",
};

export default function EntityDossier({ entity, onClose }: { entity: EntityProfile; onClose: () => void }) {
    const relevance = entity.relevance_score ?? 0;
    const stories = entity.connected_stories ?? [];

    // Sentiment breakdown
    const sentCounts = useMemo(() => {
        const s = entity.sentiment || {};
        return {
            positive: Number(s.positive ?? 0),
            negative: Number(s.negative ?? 0),
            neutral: Number(s.neutral ?? 0),
        };
    }, [entity.sentiment]);

    const sentTotal = sentCounts.positive + sentCounts.negative + sentCounts.neutral;
    const dominant = sentCounts.negative > sentCounts.positive ? "negative"
        : sentCounts.positive > sentCounts.negative ? "positive" : "neutral";

    return (
        <div className="fixed inset-0 z-40 flex justify-end animate-fade-in" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-base/60 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className="relative w-full max-w-[480px] h-full bg-surface border-l border-border overflow-y-auto no-scrollbar animate-slide-left"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-surface border-b border-border px-5 py-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        <span className="text-xl">{TYPE_ICONS[entity.type?.toLowerCase()] || "•"}</span>
                        <div>
                            <h2 className="text-base font-semibold text-text-primary">{entity.name}</h2>
                            <p className="text-2xs text-text-muted uppercase tracking-wider mt-0.5">{entity.type}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* ── Scores ────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="stat-card">
                            <span className="stat-label">Relevance</span>
                            <div className="flex items-center gap-2">
                                <span className={`stat-value ${relevance >= 70 ? "text-emerald" : relevance >= 40 ? "text-amber" : "text-text-muted"}`}>
                                    {relevance}%
                                </span>
                                <div className="flex-1 h-1.5 bg-overlay rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${relevance >= 70 ? "bg-emerald" : relevance >= 40 ? "bg-amber" : "bg-text-muted"}`}
                                        style={{ width: `${relevance}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <span className="stat-label">Influence</span>
                            <div className="flex items-center gap-2">
                                <span className="stat-value">{entity.influence?.toFixed(1) ?? "—"}</span>
                                <div className="flex-1 h-1.5 bg-overlay rounded-full overflow-hidden">
                                    <div className="h-full bg-accent-bright rounded-full" style={{ width: `${Math.min(100, entity.influence)}%` }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── WHY THIS MATTERS ─────────────────── */}
                    {entity.relevance_reason && (
                        <div className="card p-4 border-l-2 border-l-accent">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield size={14} className="text-accent" />
                                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Why This Matters To You</h3>
                            </div>
                            <p className="text-sm text-text-secondary leading-relaxed">
                                {entity.relevance_reason}
                            </p>
                        </div>
                    )}

                    {/* ── Stats Row ────────────────────────── */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="stat-card text-center">
                            <span className="stat-label">Mentions</span>
                            <span className="stat-value">{entity.mentions}</span>
                        </div>
                        <div className="stat-card text-center">
                            <span className="stat-label">Risk Tags</span>
                            <span className="stat-value">{entity.risk_tags?.length || 0}</span>
                        </div>
                        <div className="stat-card text-center">
                            <span className="stat-label">Connections</span>
                            <span className="stat-value">{entity.relationships?.length || 0}</span>
                        </div>
                    </div>

                    {/* ── Sentiment Breakdown ──────────────── */}
                    <div className="card p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={14} className="text-text-secondary" />
                            <h3 className="section-title">Sentiment</h3>
                        </div>
                        {sentTotal > 0 && (
                            <div className="flex h-3 rounded-full overflow-hidden bg-overlay mb-2">
                                {sentCounts.positive > 0 && (
                                    <div className="bg-emerald/70" style={{ width: `${(sentCounts.positive / sentTotal) * 100}%` }} />
                                )}
                                {sentCounts.neutral > 0 && (
                                    <div className="bg-text-muted/30" style={{ width: `${(sentCounts.neutral / sentTotal) * 100}%` }} />
                                )}
                                {sentCounts.negative > 0 && (
                                    <div className="bg-rose/70" style={{ width: `${(sentCounts.negative / sentTotal) * 100}%` }} />
                                )}
                            </div>
                        )}
                        <div className="flex justify-between text-2xs text-text-muted">
                            <span className="text-emerald">{sentCounts.positive} positive</span>
                            <span>{sentCounts.neutral} neutral</span>
                            <span className="text-rose">{sentCounts.negative} negative</span>
                        </div>
                    </div>

                    {/* ── Connected Stories ─────────────────── */}
                    {stories.length > 0 && (
                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <BookOpen size={14} className="text-violet" />
                                <h3 className="section-title">Connected Stories</h3>
                            </div>
                            <div className="space-y-2">
                                {stories.map((story, i) => (
                                    <div key={i} className="flex items-start gap-3 p-2 rounded-md bg-raised border border-border/60">
                                        <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${SENT_DOT[story.sentiment] || "bg-text-muted"}`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium text-text-primary capitalize">{story.theme}</p>
                                            <p className="text-2xs text-text-muted mt-0.5 truncate">{story.sample_title}</p>
                                        </div>
                                        <span className="text-2xs text-text-muted font-mono flex-shrink-0">{story.article_count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Network ──────────────────────────── */}
                    {entity.relationships?.length > 0 && (
                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <GitBranch size={14} className="text-sky" />
                                <h3 className="section-title">Network</h3>
                            </div>
                            <div className="space-y-1.5">
                                {entity.relationships.slice(0, 8).map((rel, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <span className="text-text-primary font-medium truncate flex-1">{rel.entity_name}</span>
                                        <div className="w-16 h-1 bg-overlay rounded-full overflow-hidden">
                                            <div className="h-full bg-sky/50 rounded-full" style={{ width: `${Math.min(100, rel.strength * 10)}%` }} />
                                        </div>
                                        <span className="text-2xs text-text-muted font-mono w-4 text-right">{rel.strength}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Risk Tags ────────────────────────── */}
                    {entity.risk_tags?.length > 0 && (
                        <div className="card p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle size={14} className="text-amber" />
                                <h3 className="section-title">Risk Tags</h3>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {entity.risk_tags.map((tag, i) => (
                                    <span key={i} className="badge badge-rose text-2xs">{tag.replace(/_/g, " ")}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Timeline ─────────────────────────── */}
                    <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border">
                        <span>First seen: {entity.first_seen ? new Date(entity.first_seen).toLocaleDateString() : "—"}</span>
                        <span>Last seen: {entity.last_seen ? formatRelative(entity.last_seen) : "—"}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
