"use client";

import PulseBar from "@/components/dashboard/PulseBar";
import AskRobin from "@/components/dashboard/AskRobin";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <>
            <PulseBar />
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
            <AskRobin />
        </>
    );
}
