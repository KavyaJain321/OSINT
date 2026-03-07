"use client";

import { useState } from "react";
import {
    Bell, Mail, MessageSquare, Phone, Globe, Settings,
    Save, Clock, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelConfig {
    id: string;
    label: string;
    icon: React.ReactNode;
    enabled: boolean;
    value: string;
    alwaysOn?: boolean;
}

interface RoutingRow {
    level: string;
    color: string;
    app: boolean;
    email: string; // "on" | "digest" | "off"
    whatsapp: boolean;
    sms: boolean;
    webhook: boolean;
}

const INITIAL_CHANNELS: ChannelConfig[] = [
    { id: "app", label: "In-App", icon: <Bell size={16} />, enabled: true, value: "Always on", alwaysOn: true },
    { id: "email", label: "Email", icon: <Mail size={16} />, enabled: true, value: "" },
    { id: "whatsapp", label: "WhatsApp", icon: <MessageSquare size={16} />, enabled: false, value: "" },
    { id: "sms", label: "SMS", icon: <Phone size={16} />, enabled: false, value: "" },
    { id: "webhook", label: "Webhook", icon: <Globe size={16} />, enabled: false, value: "" },
];

const INITIAL_ROUTING: RoutingRow[] = [
    { level: "Critical", color: "text-rose", app: true, email: "on", whatsapp: true, sms: true, webhook: true },
    { level: "High", color: "text-amber", app: true, email: "on", whatsapp: false, sms: false, webhook: true },
    { level: "Medium", color: "text-sky", app: true, email: "digest", whatsapp: false, sms: false, webhook: false },
    { level: "Low", color: "text-text-muted", app: true, email: "digest", whatsapp: false, sms: false, webhook: false },
];

export default function NotificationSettingsPage() {
    const [channels, setChannels] = useState(INITIAL_CHANNELS);
    const [routing, setRouting] = useState(INITIAL_ROUTING);
    const [quietStart, setQuietStart] = useState("22:00");
    const [quietEnd, setQuietEnd] = useState("07:00");
    const [digestTime, setDigestTime] = useState("08:00");
    const [saved, setSaved] = useState(false);

    const toggleChannel = (id: string) => {
        setChannels(chs => chs.map(c =>
            c.id === id && !c.alwaysOn ? { ...c, enabled: !c.enabled } : c
        ));
    };

    const updateChannelValue = (id: string, value: string) => {
        setChannels(chs => chs.map(c => c.id === id ? { ...c, value } : c));
    };

    const toggleRouting = (levelIdx: number, field: keyof RoutingRow) => {
        setRouting(rows => rows.map((r, i) => {
            if (i !== levelIdx) return r;
            if (field === "email") {
                const cycle = { on: "digest", digest: "off", off: "on" } as Record<string, string>;
                return { ...r, email: cycle[r.email] || "on" };
            }
            return { ...r, [field]: !(r[field] as boolean) };
        }));
    };

    const handleSave = () => {
        const prefs = { channels, routing, quietStart, quietEnd, digestTime };
        localStorage.setItem("robin_notification_prefs", JSON.stringify(prefs));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="p-6 max-w-3xl space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Settings size={20} className="text-text-secondary" />
                    <h1 className="text-lg font-semibold text-text-primary">Notification Settings</h1>
                </div>
                <button
                    onClick={handleSave}
                    className={cn("btn text-xs flex items-center gap-1.5", saved ? "btn-ghost text-emerald" : "btn-primary")}
                >
                    <Save size={14} /> {saved ? "Saved ✓" : "Save Preferences"}
                </button>
            </div>

            {/* ── Channels ──────────────────────── */}
            <div className="card p-5">
                <h2 className="section-title mb-4">Channels</h2>
                <div className="space-y-3">
                    {channels.map(ch => (
                        <div key={ch.id} className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0">
                            <button
                                onClick={() => toggleChannel(ch.id)}
                                className={cn(
                                    "w-10 h-5 rounded-full transition-colors flex items-center px-0.5",
                                    ch.enabled ? "bg-accent" : "bg-overlay",
                                    ch.alwaysOn && "opacity-60 cursor-not-allowed"
                                )}
                                disabled={ch.alwaysOn}
                            >
                                <div className={cn(
                                    "w-4 h-4 rounded-full bg-white transition-transform",
                                    ch.enabled ? "translate-x-5" : "translate-x-0"
                                )} />
                            </button>
                            <div className={cn("p-2 rounded-md", ch.enabled ? "bg-accent/10 text-accent" : "bg-overlay text-text-muted")}>
                                {ch.icon}
                            </div>
                            <div className="flex-1">
                                <span className={cn("text-sm font-medium", ch.enabled ? "text-text-primary" : "text-text-muted")}>{ch.label}</span>
                            </div>
                            {ch.alwaysOn ? (
                                <span className="text-2xs text-text-muted">Always on</span>
                            ) : ch.enabled ? (
                                <input
                                    className="input text-xs w-48"
                                    placeholder={ch.id === "email" ? "you@example.com" : ch.id === "webhook" ? "https://hooks.slack.com/..." : "+91-XXXXXXXXXX"}
                                    value={ch.value}
                                    onChange={e => updateChannelValue(ch.id, e.target.value)}
                                />
                            ) : (
                                <span className="text-2xs text-text-muted">Not configured</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Alert Routing Matrix ──────────── */}
            <div className="card p-5">
                <h2 className="section-title mb-4">Alert Routing</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-text-muted">
                                <th className="text-left py-2 font-medium">Level</th>
                                <th className="text-center py-2 font-medium">App</th>
                                <th className="text-center py-2 font-medium">Email</th>
                                <th className="text-center py-2 font-medium">WhatsApp</th>
                                <th className="text-center py-2 font-medium">SMS</th>
                                <th className="text-center py-2 font-medium">Webhook</th>
                            </tr>
                        </thead>
                        <tbody>
                            {routing.map((row, i) => (
                                <tr key={row.level} className="border-t border-border/50">
                                    <td className={cn("py-3 font-semibold", row.color)}>{row.level}</td>
                                    <td className="text-center">
                                        <input type="checkbox" checked={row.app} readOnly className="accent-accent" />
                                    </td>
                                    <td className="text-center">
                                        <button
                                            onClick={() => toggleRouting(i, "email")}
                                            className={cn(
                                                "px-2 py-0.5 rounded text-2xs font-medium transition-colors",
                                                row.email === "on" ? "bg-accent/20 text-accent"
                                                    : row.email === "digest" ? "bg-amber/20 text-amber"
                                                        : "bg-overlay text-text-muted"
                                            )}
                                        >
                                            {row.email === "on" ? "✓ On" : row.email === "digest" ? "Digest" : "Off"}
                                        </button>
                                    </td>
                                    <td className="text-center">
                                        <input type="checkbox" checked={row.whatsapp} onChange={() => toggleRouting(i, "whatsapp")} className="accent-accent" />
                                    </td>
                                    <td className="text-center">
                                        <input type="checkbox" checked={row.sms} onChange={() => toggleRouting(i, "sms")} className="accent-accent" />
                                    </td>
                                    <td className="text-center">
                                        <input type="checkbox" checked={row.webhook} onChange={() => toggleRouting(i, "webhook")} className="accent-accent" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Quiet Hours ──────────────────── */}
            <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Shield size={14} className="text-text-secondary" />
                    <h2 className="section-title">Quiet Hours</h2>
                </div>
                <p className="text-xs text-text-muted mb-3">
                    No WhatsApp or SMS between these hours. Critical alerts are always delivered.
                </p>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">From</span>
                        <input type="time" value={quietStart} onChange={e => setQuietStart(e.target.value)} className="input text-xs w-28" />
                    </div>
                    <span className="text-text-muted">→</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">To</span>
                        <input type="time" value={quietEnd} onChange={e => setQuietEnd(e.target.value)} className="input text-xs w-28" />
                    </div>
                </div>
            </div>

            {/* ── Digest Schedule ──────────────── */}
            <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={14} className="text-text-secondary" />
                    <h2 className="section-title">Email Digest</h2>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary">Send digest every morning at</span>
                    <input type="time" value={digestTime} onChange={e => setDigestTime(e.target.value)} className="input text-xs w-28" />
                </div>
                <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs text-text-muted">Include:</span>
                    {["Summary", "Top Signals", "Sentiment Change", "Watch List"].map(item => (
                        <label key={item} className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                            <input type="checkbox" defaultChecked className="accent-accent" />
                            {item}
                        </label>
                    ))}
                </div>
            </div>
        </div>
    );
}
