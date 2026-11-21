import assert from "node:assert/strict";
import { test } from "vitest";
import {
	changesToCsv,
	codesToCsv,
	isoDate,
	keepEntity,
	parseChanges,
	parseCodes,
} from "../../src/sources/fetch-ons-code-history";

const CHANGES = [
	"GEOGCD,GEOGNM,GEOGNMW,GEOGCD_P,GEOGNM_P,GEOGNMW_P,SI_ID,SI_TITLE,OPER_DATE,ENTITYCD,YEAR",
	"E05011111,New,,E05000001,Old,,1,Order,01/04/2019 00:00,E05,2019",
	"E05011111,New,,E05000001,Old,,1,Order,01/04/2019 00:00,E05,2019",
	"E05011111,New,,E05011111,Same,,1,Order,01/04/2019 00:00,E05,2019",
	"E05011112,Blank,,,,,1,Order,01/04/2019 00:00,E05,2019",
	"E05011113,NoDate,,E05000002,Old,,1,Order,,E05,2019",
	"E99000001,Other,,E99000002,Other,,1,Order,01/04/2019 00:00,E99,2019",
	"00GG02,Legacy,,00GG01,Legacy,,1,Order,01/04/2003 00:00,00G,2003",
].join("\n");

test("changes keep dated pairs of the entities the atlas holds, once each", () => {
	assert.deepEqual(parseChanges(CHANGES), [
		{
			predecessor: "00GG01",
			successor: "00GG02",
			date: "2003-04-01",
			entity: "00G",
		},
		{
			predecessor: "E05000001",
			successor: "E05011111",
			date: "2019-04-01",
			entity: "E05",
		},
	]);
});

test("a change file without the expected columns is rejected", () => {
	assert.throws(() => parseChanges("A,B\n1,2"), /GEOGCD/);
});

test("code dates keep the earliest introduction and an end only when no row is open", () => {
	const text = [
		"GEOGCD,GEOGNM,GEOGNMW,SI_ID,SI_TITLE,OPER_DATE,TERM_DATE,PARENTCD,ENTITYCD,OWNER,STATUS",
		"E05000001,A,,1,O,01/01/2009 00:00,31/03/2019 00:00,E07000001,E05,x,live",
		"E05000002,B,,1,O,01/01/2009 00:00,31/03/2019 00:00,E07000001,E05,x,live",
		"E05000002,B,,2,O,01/04/2020 00:00,,E07000001,E05,x,live",
		"E05000003,C,,1,O,01/04/2019 00:00,,E07000001,E05,x,live",
		"E05000003,C,,2,O,01/06/2018 00:00,,E07000001,E05,x,live",
		"E99000001,D,,1,O,01/04/2019 00:00,,E07000001,E99,x,live",
	].join("\n");
	assert.deepEqual(parseCodes(text), [
		{
			code: "E05000001",
			introduced: "2009-01-01",
			terminated: "2019-03-31",
			entity: "E05",
		},
		{
			code: "E05000002",
			introduced: "2009-01-01",
			terminated: "",
			entity: "E05",
		},
		{
			code: "E05000003",
			introduced: "2018-06-01",
			terminated: "",
			entity: "E05",
		},
	]);
});

test("dates are normalised and invalid ones dropped", () => {
	assert.equal(isoDate("01/04/2019 00:00"), "2019-04-01");
	assert.equal(isoDate("1/4/2019"), "2019-04-01");
	assert.equal(isoDate(""), "");
	assert.equal(isoDate("32/01/2019"), "");
	assert.equal(isoDate("01/13/2019"), "");
});

test("entities are kept by code or by the legacy shape", () => {
	assert.equal(keepEntity("E05"), true);
	assert.equal(keepEntity("00G"), true);
	assert.equal(keepEntity("E92"), false);
	assert.equal(keepEntity("TL3"), false);
});

test("the compact files have a header and quote fields that need it", () => {
	assert.equal(
		changesToCsv([
			{
				predecessor: "A",
				successor: "B,C",
				date: "2020-01-01",
				entity: "E05",
			},
		]),
		'predecessor,successor,date,entity\nA,"B,C",2020-01-01,E05\n',
	);
	assert.equal(
		codesToCsv([
			{
				code: "A",
				introduced: "2009-01-01",
				terminated: "",
				entity: "E05",
			},
		]),
		"code,introduced,terminated,entity\nA,2009-01-01,,E05\n",
	);
});
