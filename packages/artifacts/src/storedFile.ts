/**
 * A published artifact sent from disk rather than held in memory: a whole
 * boundary release can run to hundreds of megabytes. Its validator is the
 * content hash the build recorded, so the file is never read to answer a
 * conditional request.
 */
export type StoredFile = {
	path: string;
	/** The size of the content, once any stored encoding is undone. */
	bytes: number;
	/** `sha256:` followed by the hex digest of the content. */
	contentHash: string;
	/**
	 * Set when the file is stored gzipped: its size on disk. It is sent as it
	 * is to a client that accepts gzip, and decoded for one that does not.
	 */
	gzipBytes?: number;
};
