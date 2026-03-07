import Sidebar from "@/components/Sidebar";
import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";

export const metadata: Metadata = {
    title: "Dashboard",
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-base overflow-hidden">
            <Sidebar />
            <main className="flex-1 ml-[220px] flex flex-col overflow-hidden">
                <DashboardShell>{children}</DashboardShell>
            </main>
        </div>
    );
}

