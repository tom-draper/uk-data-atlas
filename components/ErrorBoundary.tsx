// components/ErrorBoundary.tsx
"use client";
import { Component, ReactNode } from "react";
import ErrorDisplay from "@/components/displays/ErrorDisplay";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: any) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback || (
					<ErrorDisplay
						message={
							this.state.error?.message || "Something went wrong"
						}
					/>
				)
			);
		}

		return this.props.children;
	}
}
