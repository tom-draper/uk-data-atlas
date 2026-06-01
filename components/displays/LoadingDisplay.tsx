// components/LoadingDisplay.tsx
"use client";
import Image from "next/image";

export default function LoadingDisplay() {
	return (
		<div className="absolute inset-0 flex items-center justify-center bg-[#fafafa] z-10">
			<div className="text-sm text-gray-500">
				<Image src="/UK-2.png" alt="" width={300} height={200} className="mb-10 mr-4" style={{ height: "200px", width: "auto" }} />
			</div>
		</div>
	);
}
