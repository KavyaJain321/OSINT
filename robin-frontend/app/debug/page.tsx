"use client";

import { useEffect, useState } from "react";

export default function DebugPage() {
    const [results, setResults] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;

        async function runTests() {
            const out: Record<string, unknown> = {
                NEXT_PUBLIC_API_URL: apiUrl || "NOT SET",
                timestamp: new Date().toISOString(),
            };

            // Test 1: scraper-status
            try {
                const r = await fetch(`${apiUrl}/api/test/scraper-status`);
                const data = await r.json();
                out.scraperStatus = {
                    ok: r.ok,
                    status: r.status,
                    total_articles: data.total_articles,
                    scraper_running: data.scraper_running,
                };
            } catch (e) {
                out.scraperStatus = { error: String(e) };
            }

            // Test 2: intelligence
            try {
                const r = await fetch(`${apiUrl}/api/test/intelligence`);
                const data = await r.json();
                out.intelligence = {
                    ok: r.ok,
                    status: r.status,
                    signals: data.signals?.length ?? 0,
                    entities: data.entity_profiles?.length ?? 0,
                    has_threat: !!data.threat_assessment,
                };
            } catch (e) {
                out.intelligence = { error: String(e) };
            }

            // Test 3: articles
            try {
                const r = await fetch(`${apiUrl}/api/test/articles`);
                const data = await r.json();
                out.articles = {
                    ok: r.ok,
                    status: r.status,
                    total: data.total,
                    sample: data.data?.[0]?.title?.substring(0, 60),
                };
            } catch (e) {
                out.articles = { error: String(e) };
            }

            // Test 4: sources
            try {
                const r = await fetch(`${apiUrl}/api/test/sources`);
                const data = await r.json();
                out.sources = {
                    ok: r.ok,
                    status: r.status,
                    count: data.data?.length ?? 0,
                };
            } catch (e) {
                out.sources = { error: String(e) };
            }

            setResults(out);
            setLoading(false);
        }

        runTests();
    }, []);

    return (
        <div style={{ background: "#0a0a0f", minHeight: "100vh", padding: "24px", fontFamily: "monospace", color: "#e0e0e0" }}>
            <h1 style={{ color: "#00d4ff", marginBottom: "24px", fontSize: "20px" }}>🔍 ROBIN API Debug</h1>
            {loading ? (
                <p style={{ color: "#888" }}>Running tests…</p>
            ) : (
                <pre style={{
                    background: "#111",
                    padding: "20px",
                    borderRadius: "8px",
                    border: "1px solid #222",
                    overflow: "auto",
                    fontSize: "13px",
                    lineHeight: "1.6",
                }}>
                    {JSON.stringify(results, null, 2)}
                </pre>
            )}
            <p style={{ color: "#555", marginTop: "16px", fontSize: "12px" }}>
                Open browser DevTools → Console to see any additional CORS or network errors
            </p>
        </div>
    );
}
