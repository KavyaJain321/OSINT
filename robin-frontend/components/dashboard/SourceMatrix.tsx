"use client";

import { useMemo } from "react";
import { useIntelligenceData } from "@/lib/hooks/useIntelligence";

interface SourceReliability {
    source_name?: string;
    name?: string;
    total_articles?: number;
    avg_importance?: number;
    sentiment_distribution?: { positive?: number; negative?: number; neutral?: number };
    reliability_score?: number;
}

interface NarrativePattern {
    theme?: string;
    pattern?: string;
    sentiment?: string;
}

const SENT_CELL: Record<string, string> = {
    negative: "bg-rose/30 text-rose",
    positive: "bg-emerald/30 text-emerald",
    neutral: "bg-sky/20 text-sky",
    mixed: "bg-amber/20 text-amber",
};

export default function SourceMatrix() {
    const { data: intel } = useIntelligenceData();
    const intelData = intel as {
        source_reliability?: SourceReliability[];
        threat_assessment?: { patterns?: NarrativePattern[] };
    } | undefined;

    const sources = useMemo(() => {
        return (intelData?.source_reliability || []).slice(0, 8);
    }, [intelData]);

    const topics = useMemo(() => {
        const patterns = intelData?.threat_assessment?.patterns || [];
        return patterns.slice(0, 5).map(p => p.theme || p.pattern || "Topic");
    }, [intelData]);

    if (sources.length === 0) {
        return (
            <div className="card p-6 text-center">
                <p className="text-xs text-text-muted">Source coverage data will appear after content is analyzed.</p>
            </div>
        );
    }

    return (
        <div className="card overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr>
                        <th className="th text-left sticky left-0 bg-surface z-10">Source</th>
                        <th className="th text-center">Volume</th>
                        <th className="th text-center">Reliability</th>
                        <th className="th text-center">Avg Importance</th>
                        <th className="th text-center">Positive</th>
                        <th className="th text-center">Negative</th>
                    </tr>
                </thead>
                <tbody>
                    {sources.map((src, i) => {
                        const name = src.source_name || src.name || `Source ${i + 1}`;
                        const total = src.total_articles || 0;
                        const reliability = src.reliability_score ?? 0;
                        const avgImp = src.avg_importance ?? 0;
                        const posPct = src.sentiment_distribution?.positive ?? 0;
                        const negPct = src.sentiment_distribution?.negative ?? 0;

                        return (
                            <tr key={i} className="table-row">
                                <td className="td font-medium text-text-primary sticky left-0 bg-surface">
                                    <span className="truncate block max-w-[160px]">{name}</span>
                                </td>
                                <td className="td text-center">
                                    <span className="font-mono">{total}</span>
                                </td>
                                <td className="td text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <div className="w-12 h-1.5 bg-overlay rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${reliability >= 70 ? "bg-emerald" : reliability >= 40 ? "bg-amber" : "bg-rose"}`}
                                                style={{ width: `${reliability}%` }}
                                            />
                                        </div>
                                        <span className="font-mono text-2xs text-text-muted">{Math.round(reliability)}</span>
                                    </div>
                                </td>
                                <td className="td text-center">
                                    <span className={`font-mono ${avgImp >= 7 ? "text-rose" : avgImp >= 5 ? "text-amber" : "text-text-muted"}`}>
                                        {avgImp.toFixed(1)}
                                    </span>
                                </td>
                                <td className="td text-center">
                                    <HeatCell value={posPct} type="positive" />
                                </td>
                                <td className="td text-center">
                                    <HeatCell value={negPct} type="negative" />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function HeatCell({ value, type }: { value: number; type: "positive" | "negative" }) {
    const pct = Math.round(value * 100);
    if (pct === 0) return <span className="text-text-muted">—</span>;

    const intensity = pct >= 50 ? "high" : pct >= 20 ? "med" : "low";
    const cls = type === "positive"
        ? `${intensity === "high" ? "bg-emerald/30 text-emerald" : intensity === "med" ? "bg-emerald/15 text-emerald/70" : "bg-emerald/5 text-emerald/50"}`
        : `${intensity === "high" ? "bg-rose/30 text-rose" : intensity === "med" ? "bg-rose/15 text-rose/70" : "bg-rose/5 text-rose/50"}`;

    return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-2xs font-mono ${cls}`}>
            {pct}%
        </span>
    );
}
