export function getMatchColorClass(percentage: number): string {
	if (percentage >= 80) return "text-green-600";
	if (percentage >= 50) return "text-yellow-600";
	if (percentage > 0) return "text-orange-600";
	return "text-gray-500/80";
}
