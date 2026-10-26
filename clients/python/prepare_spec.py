"""Derive the document openapi-python-client reads from services/api/openapi.yaml.

`openapi.yaml` itself is valid OpenAPI 3.1 and is not edited for this. The Python
generator cannot represent four constructs in it, and drops the schemas that use
them, along with every response that refers to those schemas. This script
rewrites exactly those constructs in a copy, so no response is lost:

1. `const` is rewritten as a one-value `enum`. The Problem refinements narrow
   the parent's `code` enum with `const`, which the generator cannot merge.
2. `CoordinateConversion.target.crs` is given a title. It would otherwise take
   the same generated enum name as the sibling `targetCrs`.
3. The two inline `{type: object, additionalProperties: {type: string}}`
   download maps in `BoundaryReleaseDownloads` become one shared schema. Their
   generated model names collide.

Usage: prepare_spec.py <openapi.yaml> <output.yaml>
"""

import sys
from typing import Any

from ruamel.yaml import YAML

JSON_TYPES = {str: "string", bool: "boolean", int: "integer", float: "number"}


def const_to_enum(node: Any) -> None:
    if isinstance(node, dict):
        if "const" in node:
            value = node.pop("const")
            node.setdefault("type", JSON_TYPES[type(value)])
            node["enum"] = [value]
        for child in node.values():
            const_to_enum(child)
    elif isinstance(node, list):
        for child in node:
            const_to_enum(child)


def prepare(spec: dict[str, Any]) -> dict[str, Any]:
    schemas = spec["components"]["schemas"]
    const_to_enum(schemas)

    schemas["CoordinateConversion"]["properties"]["target"]["properties"]["crs"][
        "title"
    ] = "CoordinateConversionGridCrs"

    schemas["DownloadUrls"] = {
        "type": "object",
        "additionalProperties": {"type": "string"},
    }
    for variant in schemas["BoundaryReleaseDownloads"]["oneOf"]:
        for name in ("geojson", "geoparquet"):
            prop = variant["properties"].get(name)
            if prop is not None:
                variant["properties"][name] = {
                    "description": prop["description"],
                    "allOf": [{"$ref": "#/components/schemas/DownloadUrls"}],
                }
    return spec


def main(source: str, target: str) -> None:
    yaml = YAML(typ="safe")
    yaml.default_flow_style = False
    yaml.width = 4096
    with open(source, encoding="utf-8") as handle:
        spec = yaml.load(handle)
    with open(target, "w", encoding="utf-8") as handle:
        yaml.dump(prepare(spec), handle)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
