"use client";

import { createContext, useContext } from "react";

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
	return useContext(ChartLoadingContext);
}

export function ChartLoadingBackground() {
	const loading = useChartsLoading();

	if (!loading) return null;

	return (
		<div
			className="pointer-events-none absolute inset-0 z-0 chart-card-shimmer"
			aria-hidden="true"
		/>
	);
}

export function ChartContentPlaceholder({
	className = "h-7",
}: {
	className?: string;
}) {
	return <div className={`chart-shimmer ${className}`} aria-hidden="true" />;
}
