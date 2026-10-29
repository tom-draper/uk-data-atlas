/**
 * NHS ODS organisation codes to GSS codes for the April 2025 ICBs.
 * Source: ONS LSOA (2021) to SICBL to ICB to Cancer Alliances to LAD
 * (April 2025) Lookup in England, fields ICB25CDH and ICB25CD.
 * https://www.arcgis.com/home/item.html?id=d3822450044541edbcb4369d6e83948a
 * This vintage matches the March 2026 waiting-times extract. April 2026
 * reorganisations introduced new ICBs, so this is not a current-code lookup.
 */
export const ICB_ODS_TO_GSS: Readonly<Record<string, string>> = {
	QE1: "E54000048",
	QF7: "E54000061",
	QGH: "E54000019",
	QH8: "E54000026",
	QHG: "E54000024",
	QHL: "E54000055",
	QHM: "E54000050",
	QJ2: "E54000058",
	QJG: "E54000023",
	QJK: "E54000037",
	QJM: "E54000013",
	QK1: "E54000015",
	QKK: "E54000030",
	QKS: "E54000032",
	QM7: "E54000025",
	QMF: "E54000029",
	QMJ: "E54000028",
	QMM: "E54000022",
	QNC: "E54000010",
	QNQ: "E54000034",
	QNX: "E54000064",
	QOC: "E54000011",
	QOP: "E54000057",
	QOQ: "E54000051",
	QOX: "E54000040",
	QPM: "E54000059",
	QR1: "E54000043",
	QRL: "E54000042",
	QRV: "E54000027",
	QSL: "E54000038",
	QT1: "E54000060",
	QT6: "E54000036",
	QU9: "E54000044",
	QUA: "E54000062",
	QUE: "E54000056",
	QUY: "E54000039",
	QVV: "E54000041",
	QWE: "E54000031",
	QWO: "E54000054",
	QWU: "E54000018",
	QXU: "E54000063",
	QYG: "E54000008",
};
