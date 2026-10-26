from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.terrain_point_source_coverage_kind import TerrainPointSourceCoverageKind

T = TypeVar("T", bound="TerrainPointSourceCoverage")


@_attrs_define
class TerrainPointSourceCoverage:
    """
    Attributes:
        bbox (list[float]):
        footprint_hash (str):
        kind (TerrainPointSourceCoverageKind):
    """

    bbox: list[float]
    footprint_hash: str
    kind: TerrainPointSourceCoverageKind
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        bbox = self.bbox

        footprint_hash = self.footprint_hash

        kind = self.kind.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "bbox": bbox,
                "footprintHash": footprint_hash,
                "kind": kind,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        bbox = cast(list[float], d.pop("bbox"))

        footprint_hash = d.pop("footprintHash")

        kind = TerrainPointSourceCoverageKind(d.pop("kind"))

        terrain_point_source_coverage = cls(
            bbox=bbox,
            footprint_hash=footprint_hash,
            kind=kind,
        )

        terrain_point_source_coverage.additional_properties = d
        return terrain_point_source_coverage

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
