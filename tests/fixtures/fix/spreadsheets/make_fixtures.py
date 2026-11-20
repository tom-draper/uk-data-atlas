"""Builds the spreadsheet fixtures in this folder, and, with --large, the big
ones used to time the page. Needs xlsxwriter, openpyxl and odfpy:

    python3 -m venv venv && venv/bin/pip install xlsxwriter openpyxl odfpy
    venv/bin/python make_fixtures.py [--large OUTPUT_DIR LSOA_TSV LA_TSV]

The small files are written by tools other than ours (xlsxwriter, openpyxl and
odfpy), so the reader is tested against files it did not make. Area codes and
names come from the 2011 LSOA and 2021 local authority releases.
"""

import datetime
import random
import sys
from pathlib import Path

import openpyxl
import xlsxwriter
from odf.opendocument import OpenDocumentSpreadsheet
from odf.style import Style, TextProperties
from odf.table import Table, TableCell, TableRow
from odf.text import P

HERE = Path(__file__).parent

LSOA = [
    ("E01000001", "City of London 001A"),
    ("E01000002", "City of London 001B"),
    ("E01000003", "City of London 001C"),
    ("E01000005", "City of London 001E"),
    ("E01000006", "Barking and Dagenham 016A"),
    ("E01000007", "Barking and Dagenham 015A"),
    ("E01000008", "Barking and Dagenham 015B"),
    ("E01000009", "Barking and Dagenham 016B"),
    ("E01000010", "Barking and Dagenham 015C"),
    ("E01000011", "Barking and Dagenham 016C"),
    ("E01000012", "Barking and Dagenham 015D"),
    ("E01000013", "Barking and Dagenham 016D"),
]

LOCAL_AUTHORITIES = [
    ("E06000022", "Bath and North East Somerset", 4312, 0.0361),
    ("E06000024", "North Somerset", 5120, 0.0397),
    ("E06000058", "Bournemouth, Christchurch and Poole", 9876, 0.0412),
    ("E06000059", "Dorset", 6234, 0.0274),
    ("E07000026", "Allerdale", 1890, 0.0368),
    ("E07000187", "Mendip", 2045, 0.0289),
    ("E07000189", "South Somerset", 2601, 0.0245),
    ("E07000246", "Somerset West and Taunton", 2788, 0.0302),
]


def analyst_xlsx(path):
    """A policy analyst's workbook: a title, a note, the header on row 4,
    numbers stored as text, dates, a formula with its cached value."""
    book = xlsxwriter.Workbook(str(path))
    sheet = book.add_worksheet("Households 2011")
    bold = book.add_format({"bold": True})
    date = book.add_format({"num_format": "dd/mm/yyyy"})
    pct = book.add_format({"num_format": "0.0%"})
    sheet.merge_range("A1:F1", "Households by LSOA, 2011 Census (draft)", bold)
    sheet.write_string("A3", "Source: ONS. Prepared by the policy team.")
    for column, name in enumerate(
        ["LSOA11CD", "LSOA11NM", "Population", "Households", "Surveyed", "Share"]
    ):
        sheet.write_string(3, column, name, bold)

    rows = []
    for index, (code, name) in enumerate(LSOA):
        shown = code
        if index == 3:
            shown = code.lower() + " "  # lower case with a trailing space
        if index == 5:
            shown = code.replace("0", "O", 2)  # letter O for zero
        if index == 7:
            shown = name  # a name where a code belongs
        rows.append((shown, name, 1500 + index * 37, 600 + index * 11))
    total = sum(row[3] for row in rows)
    for index, (shown, name, population, households) in enumerate(rows):
        r = 4 + index
        sheet.write_string(r, 0, shown)
        sheet.write_string(r, 1, name)
        if index % 2 == 0:
            sheet.write_string(r, 2, str(population))  # a number stored as text
        else:
            sheet.write_number(r, 2, population)
        sheet.write_number(r, 3, households)
        sheet.write_datetime(r, 4, datetime.datetime(2011, 3, 27 + index % 3), date)
        sheet.write_formula(
            r, 5, f"=D{r + 1}/SUM(D$5:D${4 + len(rows)})", pct, households / total
        )
    book.close()


def multi_sheet_xlsx(path):
    """A cover sheet, an empty sheet and a hidden one before the data."""
    book = xlsxwriter.Workbook(str(path))
    cover = book.add_worksheet("Read me")
    cover.write_string("A1", "Claimant counts for the council report")
    cover.write_string("A3", "The data are on the sheet called Claimants.")
    book.add_worksheet("Scratch")
    hidden = book.add_worksheet("Old numbers")
    hidden.write_row("A1", ["old", "n"])
    hidden.write_row("A2", ["a", 1])
    hidden.hide()
    data = book.add_worksheet("Claimants")
    data.write_row("A1", ["Area code", "Area", "Claimants"])
    for index, (code, name, count, _) in enumerate(LOCAL_AUTHORITIES):
        data.write_row(index + 1, 0, [code, name, count])
    other = book.add_worksheet("Lookup")
    other.write_row("A1", ["code", "region"])
    other.write_row("A2", ["E06000022", "South West"])
    book.close()


def dates_1904_xlsx(path):
    book = xlsxwriter.Workbook(str(path), {"date_1904": True})
    sheet = book.add_worksheet("Dates")
    date = book.add_format({"num_format": "yyyy-mm-dd"})
    sheet.write_row("A1", ["code", "when"])
    sheet.write("A2", "E06000022")
    sheet.write_datetime("B2", datetime.datetime(2021, 3, 21), date)
    book.close()


def merged_openpyxl(path):
    """A sheet from a different writer: blank leading rows and merged cells."""
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.title = "Ward data"
    sheet["A3"] = "Households by ward"
    sheet.merge_cells("A3:C3")
    for column, name in enumerate(["ward_cd", "ward_name", "households"], start=1):
        sheet.cell(row=5, column=column, value=name)
    for row, values in enumerate(
        [("E05013400", "Amesbury East & Bulford", 3422), ("E05013403", "Avon Valley", 3655)],
        start=6,
    ):
        for column, value in enumerate(values, start=1):
            sheet.cell(row=row, column=column, value=value)
    sheet["A8"] = "Line one\nline two"
    sheet["B8"] = "  padded  "
    book.save(path)


def authorities_ods(path):
    """A local authority list as LibreOffice writes one: a title, a header on
    row 3, percentages, dates, and a huge run of blank repeated rows at the end."""
    doc = OpenDocumentSpreadsheet()
    bold = Style(name="bold", family="table-cell")
    bold.addElement(TextProperties(fontweight="bold"))
    doc.automaticstyles.addElement(bold)
    table = Table(name="Claimants")

    def row(cells):
        tr = TableRow()
        for kind, value, shown in cells:
            if kind == "string":
                cell = TableCell(valuetype="string")
            elif kind == "float":
                cell = TableCell(valuetype="float", value=value)
            elif kind == "percentage":
                cell = TableCell(valuetype="percentage", value=value)
            elif kind == "date":
                cell = TableCell(valuetype="date", datevalue=value)
            else:
                cell = TableCell()
            if shown is not None:
                cell.addElement(P(text=shown))
            tr.addElement(cell)
        table.addElement(tr)

    row([("string", None, "Claimant count by local authority")])
    row([("empty", None, None)])
    row(
        [("string", None, h) for h in
         ["Local authority code", "Local authority", "Claimants", "Rate", "As at"]]
    )
    for code, name, count, rate in LOCAL_AUTHORITIES:
        row(
            [
                ("string", None, code),
                ("string", None, name),
                ("float", str(count), f"{count:,}"),
                ("percentage", str(rate), f"{rate * 100:.1f}%"),
                ("date", "2021-12-01", "01/12/2021"),
            ]
        )
    blank = TableRow(numberrowsrepeated=1048000)
    blank.addElement(TableCell(numbercolumnsrepeated=1024))
    table.addElement(blank)
    doc.spreadsheet.addElement(table)
    doc.save(str(path))


def large(out, lsoa_tsv, la_tsv):
    """England's 2011 LSOAs as an analyst's workbook, with the mistakes a real
    file has, a local authority ODS, and a three sheet workbook."""
    out = Path(out)
    random.seed(630)
    rows = [line.rstrip("\n").split("\t") for line in open(lsoa_tsv)]
    book = xlsxwriter.Workbook(str(out / "england-lsoa-2011.xlsx"))
    sheet = book.add_worksheet("LSOA data")
    bold = book.add_format({"bold": True})
    date = book.add_format({"num_format": "yyyy-mm-dd"})
    sheet.write_string("A1", "Indicators by 2011 LSOA, England")
    sheet.write_string("A2", "Compiled for the neighbourhoods review. Contains OS data.")
    heads = ["LSOA code", "LSOA name", "Population", "Households", "Over 65 (%)",
             "Median income", "Updated"]
    for column, name in enumerate(heads):
        sheet.write_string(3, column, name, bold)
    for index, (code, name) in enumerate(rows):
        shown = code
        roll = random.random()
        if roll < 0.004:
            shown = name  # names where codes belong
        elif roll < 0.008:
            shown = code.lower()
        elif roll < 0.012:
            shown = code + " "
        elif roll < 0.016:
            shown = code[:-1]  # a digit missing
        r = 4 + index
        sheet.write_string(r, 0, shown)
        sheet.write_string(r, 1, name)
        sheet.write_number(r, 2, random.randint(1200, 3500))
        sheet.write_number(r, 3, random.randint(500, 1500))
        sheet.write_number(r, 4, round(random.uniform(5, 40), 1))
        sheet.write_string(r, 5, str(random.randint(18000, 52000)))
        sheet.write_datetime(r, 6, datetime.datetime(2024, 1, 1 + index % 28), date)
    book.close()

    las = [line.rstrip("\n").split("\t") for line in open(la_tsv)]
    authorities_large_ods(out / "local-authorities.ods", las)

    book = xlsxwriter.Workbook(str(out / "multi-sheet.xlsx"))
    cover = book.add_worksheet("Read me")
    cover.write_string("A1", "Council indicators, with sources")
    cover.write_string("A3", "Data are on the Authorities sheet.")
    data = book.add_worksheet("Authorities")
    data.write_row("A1", ["Code", "Authority", "Households"])
    for index, (code, name) in enumerate(las):
        data.write_row(index + 1, 0, [code, name, random.randint(20000, 300000)])
    book.close()


def authorities_large_ods(path, las):
    doc = OpenDocumentSpreadsheet()
    table = Table(name="Authorities")
    for values in [("Local authority code", "Local authority", "Households")] + [
        (code, name, str(random.randint(20000, 300000))) for code, name in las
    ]:
        tr = TableRow()
        for index, value in enumerate(values):
            if index == 2 and value.isdigit():
                cell = TableCell(valuetype="float", value=value)
            else:
                cell = TableCell(valuetype="string")
            cell.addElement(P(text=value))
            tr.addElement(cell)
        table.addElement(tr)
    doc.spreadsheet.addElement(table)
    doc.save(str(path))


if __name__ == "__main__":
    if "--large" in sys.argv:
        _, _, out, lsoa, la = sys.argv
        large(out, lsoa, la)
    else:
        analyst_xlsx(HERE / "analyst-lsoa.xlsx")
        multi_sheet_xlsx(HERE / "multi-sheet.xlsx")
        dates_1904_xlsx(HERE / "dates-1904.xlsx")
        merged_openpyxl(HERE / "ward-blank-rows.xlsx")
        authorities_ods(HERE / "authorities.ods")
