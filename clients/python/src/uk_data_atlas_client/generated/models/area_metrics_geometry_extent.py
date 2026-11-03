from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaMetricsGeometryExtent")


@_attrs_define
class AreaMetricsGeometryExtent:
    """How much geometry stands behind the measurements: a mainland and its islands are many parts, and a ring of land has
    more rings than parts.

        Attributes:
            parts (int):
            rings (int):
            vertices (int):
    """

    parts: int
    rings: int
    vertices: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        parts = self.parts

        rings = self.rings

        vertices = self.vertices

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "parts": parts,
                "rings": rings,
                "vertices": vertices,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        parts = d.pop("parts")

        rings = d.pop("rings")

        vertices = d.pop("vertices")

        area_metrics_geometry_extent = cls(
            parts=parts,
            rings=rings,
            vertices=vertices,
        )

        area_metrics_geometry_extent.additional_properties = d
        return area_metrics_geometry_extent

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
