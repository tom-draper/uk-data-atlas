// Stub used when NEXT_PUBLIC_MAP_TYPE !== "mapbox".
// useMapboxInitialization is never called in that case, so this is never executed.
const stub = {
	Map: class {},
	accessToken: "",
};
export default stub;
