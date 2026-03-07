"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from "react-leaflet";
import type { LatLngExpression, PointExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

interface GeoNode {
    label: string; lat: number; lng: number; events: number;
    avgImportance: number; sentiments: { positive: number; negative: number; neutral: number };
    articles: { id: string; title: string; importance: number; sentiment: string }[];
}

/* Auto-fit map bounds to nodes */
function FitBounds({ nodes }: { nodes: GeoNode[] }) {
    const map = useMap();
    useEffect(() => {
        if (nodes.length === 0) return;
        const bounds = nodes.map(n => [n.lat, n.lng] as LatLngExpression);
        map.fitBounds(bounds as any, { padding: [40, 40], maxZoom: 6 });
    }, [nodes, map]);
    return null;
}

function getColor(importance: number) {
    if (importance >= 8) return "#ef4444";
    if (importance >= 6) return "#f59e0b";
    return "#14b8a6";
}

function getRadius(events: number) {
    return Math.min(30, Math.max(8, events * 2));
}

export default function GeoMap({ nodes }: { nodes: GeoNode[] }) {
    if (nodes.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center" style={{ background: "#070910" }}>
                <span className="text-[10px] font-mono text-slate-600">NO GEOGRAPHIC DATA AVAILABLE</span>
            </div>
        );
    }

    const centerLat = nodes.reduce((s, n) => s + n.lat, 0) / nodes.length;
    const centerLng = nodes.reduce((s, n) => s + n.lng, 0) / nodes.length;
    const center: LatLngExpression = [centerLat, centerLng];

    // Create connections between top nodes
    const sortedNodes = [...nodes].sort((a, b) => b.events - a.events);
    const connections: LatLngExpression[][] = [];
    for (let i = 0; i < Math.min(sortedNodes.length, 5); i++) {
        for (let j = i + 1; j < Math.min(sortedNodes.length, 5); j++) {
            connections.push([
                [sortedNodes[i].lat, sortedNodes[i].lng] as LatLngExpression,
                [sortedNodes[j].lat, sortedNodes[j].lng] as LatLngExpression,
            ]);
        }
    }

    return (
        <MapContainer
            center={center}
            zoom={4}
            className="w-full h-full"
            style={{ background: "#070910" }}
            zoomControl={false}
            attributionControl={false}
        >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" />
            <FitBounds nodes={nodes} />

            {/* Connection lines */}
            {connections.map((line, i) => (
                <Polyline
                    key={i}
                    positions={line}
                    pathOptions={{
                        color: "#14b8a650",
                        weight: 1,
                        dashArray: "4 4",
                    }}
                />
            ))}

            {/* Geo nodes */}
            {nodes.map(node => {
                const color = getColor(node.avgImportance);
                const radius = getRadius(node.events);
                const nodeCenter: LatLngExpression = [node.lat, node.lng];
                const tooltipOffset: PointExpression = [0, -radius];
                return (
                    <CircleMarker
                        key={node.label}
                        center={nodeCenter}
                        radius={radius}
                        pathOptions={{
                            color: color,
                            fillColor: color,
                            fillOpacity: 0.25,
                            weight: 1.5,
                            opacity: 0.7,
                        }}
                    >
                        <Tooltip
                            permanent={node.events >= 5}
                            direction="top"
                            offset={tooltipOffset}
                            className="geo-tooltip"
                        >
                            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "2px", padding: "4px 8px", color: "#e2e8f0", fontSize: "11px", fontFamily: "monospace", lineHeight: 1.4 }}>
                                <div style={{ fontWeight: 600, color }}>{node.label}</div>
                                <div style={{ color: "#94a3b8", fontSize: "9px" }}>
                                    {node.events} events · risk {node.avgImportance.toFixed(1)}
                                </div>
                                {node.articles.slice(0, 2).map(a => (
                                    <div key={a.id} style={{ color: "#64748b", fontSize: "9px", marginTop: "2px" }}>
                                        → {a.title.slice(0, 50)}...
                                    </div>
                                ))}
                            </div>
                        </Tooltip>
                    </CircleMarker>
                );
            })}

            {/* Outer pulse rings for critical nodes */}
            {nodes.filter(n => n.avgImportance >= 7).map(node => {
                const pulseCenter: LatLngExpression = [node.lat, node.lng];
                return (
                    <CircleMarker
                        key={`pulse-${node.label}`}
                        center={pulseCenter}
                        radius={getRadius(node.events) + 6}
                        pathOptions={{
                            color: getColor(node.avgImportance),
                            fillColor: "transparent",
                            fillOpacity: 0,
                            weight: 1,
                            opacity: 0.3,
                            dashArray: "2 3",
                        }}
                    />
                );
            })}
        </MapContainer>
    );
}
