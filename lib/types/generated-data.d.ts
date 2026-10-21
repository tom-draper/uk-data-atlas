// CI checks a clone without generated data, so these files may not exist.
// TypeScript uses the real file when it does and falls back to this
// declaration when it does not. Every import casts its value to the type it
// expects.
declare module "@/public/data/datasets/*.json" {
	const value: unknown;
	export default value;
}
