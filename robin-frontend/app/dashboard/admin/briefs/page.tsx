"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle, XCircle, ChevronDown, ChevronUp, Zap, AlertCircle } from "lucide-react";
import { adminApi } from "@/lib/api";
import { formatRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Brief {
    id: string;
    title: string;
    problem_statement: string;
    client_name?: string;
    status: string;
    created_at: string;
    keywords_count?: number;
    sources_count?: number;
    recommended_sources?: Array<{
        name: string;
        url: string;
        source_type: string;
        url_validated?: boolean;
        url_status_code?: string;
        validation_note?: string;
    }>;
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    processing: { label: "Processing", class: "badge-sky" },
    pending_review: { label: "Pending Review", class: "badge-amber" },
    approved: { label: "Approved", class: "badge-emerald" },
    active: { label: "Active", class: "badge-emerald" },
    failed: { label: "Failed", class: "badge-rose" },
};

export default function BriefReviewPage() {
    const [briefs, setBriefs] = useState<Brief[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [status, setStatus] = useState("pending_review");
    const [actionMsg, setActionMsg] = useState<Record<string, string>>({});

    const load = async () => {
        setLoading(true);
        try {
            const res = await adminApi.briefs(status) as { data?: Brief[] };
            setBriefs(res.data ?? []);
        } catch { /* graceful */ }
        setLoading(false);
    };

    useEffect(() => { load(); }, [status]);

    const activate = async (briefId: string) => {
        setActionMsg(m => ({ ...m, [briefId]: "Activating…" }));
        try {
            await adminApi.activate(briefId);
            setActionMsg(m => ({ ...m, [briefId]: "✓ Activated" }));
            setTimeout(() => load(), 1500);
        } catch {
            setActionMsg(m => ({ ...m, [briefId]: "⚠ Failed" }));
        }
    };

    return (
        <div className="p-4 max-w-5xl">
            <div className="mb-5">
                <h1 className="text-xl font-semibold text-text-primary">Brief Review</h1>
                <p className="text-sm text-text-muted mt-0.5">Review AI-generated keywords and sources before activation</p>
            </div>

            {/* Status filter */}
            <div className="flex gap-1.5 mb-4 flex-wrap">
                {["pending_review", "approved", "active", "processing", "failed"].map(s => (
                    <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={cn(
                            "px-3 py-1 rounded text-xs font-medium transition-colors",
                            status === s
                                ? "bg-accent text-white"
                                : "bg-raised border border-border text-text-secondary hover:text-text-primary"
                        )}
                    >
                        {STATUS_CONFIG[s]?.label ?? s}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}
                </div>
            ) : briefs.length === 0 ? (
                <div className="text-center py-16 text-text-muted">
                    <FileText size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No briefs with status "{STATUS_CONFIG[status]?.label ?? status}"</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {briefs.map(brief => {
                        const isOpen = expanded === brief.id;
                        const cfg = STATUS_CONFIG[brief.status] ?? { label: brief.status, class: "badge-muted" };

                        return (
                            <div key={brief.id} className="card border border-border hover:border-border-active transition-colors">
                                {/* Brief header */}
                                <div
                                    className="flex items-start justify-between gap-3 cursor-pointer"
                                    onClick={() => setExpanded(isOpen ? null : brief.id)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className={cn("badge", cfg.class)}>{cfg.label}</span>
                                            {brief.client_name && (
                                                <span className="badge badge-muted">{brief.client_name}</span>
                                            )}
                                            <span className="text-xs text-text-muted">{formatRelative(brief.created_at)}</span>
                                        </div>
                                        <h3 className="text-sm font-medium text-text-primary">{brief.title}</h3>
                                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{brief.problem_statement}</p>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {brief.status === "approved" && (
                                            <button
                                                onClick={e => { e.stopPropagation(); activate(brief.id); }}
                                                className="btn btn-primary text-xs py-1 px-2.5 h-7"
                                            >
                                                <Zap size={11} />
                                                {actionMsg[brief.id] ?? "Activate"}
                                            </button>
                                        )}
                                        {isOpen ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                {isOpen && (
                                    <div className="mt-3 pt-3 border-t border-border animate-fade-in">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <div className="text-2xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                                                    <CheckCircle size={11} className="text-accent" />
                                                    Generated Keywords ({brief.keywords_count ?? 0})
                                                </div>
                                                <div className="p-2.5 rounded bg-raised border border-border/60 min-h-[60px]">
                                                    <p className="text-xs text-text-secondary italic">
                                                        Open the Supabase admin to review keyword details
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-2xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
                                                    <XCircle size={11} className="text-accent" />
                                                    Recommended Sources ({brief.sources_count ?? brief.recommended_sources?.length ?? 0})
                                                </div>
                                                <div className="p-2.5 rounded bg-raised border border-border/60 min-h-[60px] space-y-1.5">
                                                    {brief.recommended_sources && brief.recommended_sources.length > 0 ? (
                                                        brief.recommended_sources.map((src, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-xs">
                                                                {src.url_validated === true ? (
                                                                    <CheckCircle size={12} className="text-emerald flex-shrink-0" />
                                                                ) : src.url_validated === false ? (
                                                                    <AlertCircle size={12} className="text-amber flex-shrink-0" />
                                                                ) : (
                                                                    <span className="w-3 h-3 rounded-full bg-border flex-shrink-0" />
                                                                )}
                                                                <span className="text-text-primary truncate">{src.name}</span>
                                                                <span className="badge badge-muted text-2xs">{src.source_type}</span>
                                                                {src.url_validated === false && (
                                                                    <span className="text-2xs text-amber" title={src.validation_note}>
                                                                        ⚠ {src.url_status_code}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-xs text-text-secondary italic">
                                                            Source details will appear here after brief processing
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {brief.status === "approved" && (
                                            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
                                                <AlertCircle size={14} className="text-amber flex-shrink-0 mt-0.5" />
                                                <p className="text-xs text-text-secondary">
                                                    Activating this brief will push approved keywords to <code className="font-mono text-accent-bright">watch_keywords</code> and
                                                    approved sources to <code className="font-mono text-accent-bright">sources</code>, making them live for the next scrape cycle.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
