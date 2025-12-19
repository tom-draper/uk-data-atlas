// components/LoadingDisplay.tsx
"use client";

export default function LoadingDisplay() {
	return (
		<div className="absolute inset-0 flex items-center justify-center bg-[#fafafa] z-10">
			<div className="text-sm text-gray-500">
				<img src="UK-2.png" alt="" className="h-[200px] mb-10 mr-4" />
			</div>
		</div>
	);
}
