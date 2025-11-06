import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "UK Data Atlas",
	description: "A comprehensive atlas of UK data visualizations.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased">
				{children}
			</body>
		</html>
	);
}
