from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="AreaChildGeometryFeaturePropertiesGeneralisation")


@_attrs_define
class AreaChildGeometryFeaturePropertiesGeneralisation:
    """What the collection's tier cost this member. The tier itself is stated once, on the collection.

    Attributes:
        parts (int):
        parts_at_full_resolution (int):
        vertices (int):
        vertices_at_full_resolution (int):
    """

    parts: int
    parts_at_full_resolution: int
    vertices: int
    vertices_at_full_resolution: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        parts = self.parts

        parts_at_full_resolution = self.parts_at_full_resolution

        vertices = self.vertices

        vertices_at_full_resolution = self.vertices_at_full_resolution

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "parts": parts,
                "partsAtFullResolution": parts_at_full_resolution,
                "vertices": vertices,
                "verticesAtFullResolution": vertices_at_full_resolution,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        parts = d.pop("parts")

        parts_at_full_resolution = d.pop("partsAtFullResolution")

        vertices = d.pop("vertices")

        vertices_at_full_resolution = d.pop("verticesAtFullResolution")

        area_child_geometry_feature_properties_generalisation = cls(
            parts=parts,
            parts_at_full_resolution=parts_at_full_resolution,
            vertices=vertices,
            vertices_at_full_resolution=vertices_at_full_resolution,
        )

        area_child_geometry_feature_properties_generalisation.additional_properties = d
        return area_child_geometry_feature_properties_generalisation

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
