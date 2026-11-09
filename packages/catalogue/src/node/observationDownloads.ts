export type ObservationDownload = {
	format: "csv" | "parquet";
	artifact: string;
	href: string;
	/** The size of the file once any stored encoding is undone. */
	bytes: number;
	contentHash: string;
	/**
	 * Present when the file is stored gzipped, as CSV is: its size as sent
	 * with `Content-Encoding: gzip`.
	 */
	gzipBytes?: number;
};
