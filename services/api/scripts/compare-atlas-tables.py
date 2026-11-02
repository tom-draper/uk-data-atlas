import hashlib
import json
import sqlite3
import struct
import sys
from pathlib import Path


def snapshot(path):
    db = sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True)
    schema = db.execute(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' OR type = 'table' ORDER BY type, name"
    ).fetchall()
    tables = [entry[1] for entry in schema if entry[0] == "table"]
    if not tables:
        raise ValueError("database has no user tables: " + path)
    result = {}
    for table in tables:
        quoted = '"' + table.replace('"', '""') + '"'
        columns = [
            row[1]
            for row in db.execute("PRAGMA table_xinfo(" + quoted + ")")
            if row[6] != 1
        ]
        names = ['"' + name.replace('"', '""') + '"' for name in columns]
        ordering = ", ".join(
            part
            for name in names
            for part in ("typeof(" + name + ")", name + " COLLATE BINARY")
        )
        digest = hashlib.sha256()
        count = 0
        for row in db.execute("SELECT * FROM " + quoted + " ORDER BY " + ordering):
            count += 1
            for value in row:
                if value is None:
                    payload = b"n"
                elif isinstance(value, int):
                    payload = b"i" + str(value).encode()
                elif isinstance(value, float):
                    payload = b"f" + struct.pack(">d", value)
                elif isinstance(value, str):
                    payload = b"t" + value.encode("utf-8")
                else:
                    payload = b"b" + value
                digest.update(struct.pack(">Q", len(payload)))
                digest.update(payload)
        result[table] = {"rows": count, "sha256": digest.hexdigest()}
        print(path, table, count, digest.hexdigest(), flush=True)
    db.close()
    return schema, result


if len(sys.argv) != 3:
    sys.exit("usage: compare-atlas-tables.py BEFORE.sqlite AFTER.sqlite")
a, b = (snapshot(path) for path in sys.argv[1:])
if a != b:
    if a[0] != b[0]:
        print(
            "Schema mismatch:",
            json.dumps({"before": a[0], "after": b[0]}, indent=2),
            file=sys.stderr,
        )
    for name in sorted(a[1].keys() | b[1].keys()):
        if a[1].get(name) != b[1].get(name):
            print(
                "Table mismatch:", name, a[1].get(name), b[1].get(name), file=sys.stderr
            )
    sys.exit(1)
print("Schemas, counts and content hashes match.")
