"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardShell from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("robin_token");
        if (!token) {
            router.replace("/auth/login");
        } else {
            setChecked(true);
        }
    }, [router]);

    // Don't render dashboard until auth is verified
    if (!checked) {
        return (
            <div className="flex h-screen items-center justify-center bg-base">
                <div className="text-gray-400 text-sm">Authenticating...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-base overflow-hidden">
            <Sidebar />
            <main className="flex-1 ml-[220px] flex flex-col overflow-hidden">
                <DashboardShell>{children}</DashboardShell>
            </main>
        </div>
    );
}
