// components/ErrorDisplay.tsx
"use client";

interface ErrorDisplayProps {
	message: string;
}

export default function ErrorDisplay({ message }: ErrorDisplayProps) {
	return (
		<div className="flex items-center justify-center min-h-screen bg-gray-100">
			<div className="bg-[rgba(255,255,255,0.5)] rounded-md backdrop-blur-md shadow-lg border border-white/30 flex flex-col h-full w-62">
				<div className="shrink-0 bg-white/20 items-center overflow-hidden">
					<h2 className="px-2.5 pb-2 pt-2.5 text-sm font-semibold grow">
						Error
					</h2>
					<div className="flex items-center transition-all duration-200 text-sm px-2.5 pt-2 pb-2.5">
						{message}
					</div>
				</div>
			</div>
		</div>
	);
}
