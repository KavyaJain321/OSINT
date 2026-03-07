import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign In | ROBIN",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-base flex items-center justify-center p-4">
            {/* Background grid */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage: `
            linear-gradient(rgba(37,99,235,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,99,235,0.03) 1px, transparent 1px)
          `,
                    backgroundSize: "40px 40px",
                }}
            />
            {children}
        </div>
    );
}
