"use client";

import { createContext, use } from "react";
import { useIsDark } from "@/lib/context/ThemeContext";

const ChartLoadingContext = createContext(false);

export function ChartLoadingProvider({
	loading,
	children,
}: {
	loading: boolean;
	children: React.ReactNode;
}) {
	return (
		<ChartLoadingContext.Provider value={loading}>
			{children}
		</ChartLoadingContext.Provider>
	);
}

export function useChartsLoading() {
	return use(ChartLoadingContext);
}

export function ChartLoadingBackground() {
	const loading = useChartsLoading();
	const isDark = useIsDark();

	if (!loading) return null;

	return (
		<div
			className={`pointer-events-none absolute inset-0 z-20 flex flex-col justify-center gap-2 p-3 ${
				isDark ? "bg-slate-950/90" : "bg-slate-100/90"
			}`}
			aria-hidden="true"
		>
			<div className="chart-shimmer h-2.5 w-3/5" />
			<div className="chart-shimmer h-6 w-4/5" />
			<div className="chart-shimmer h-1.5 w-full" />
		</div>
	);
}

export function ChartContentPlaceholder({
	className = "h-7",
}: {
	className?: string;
}) {
	return <div className={`chart-shimmer ${className}`} aria-hidden="true" />;
}
