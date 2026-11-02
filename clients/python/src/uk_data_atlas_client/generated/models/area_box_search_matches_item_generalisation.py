from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar("T", bound="AreaBoxSearchMatchesItemGeneralisation")


@_attrs_define
class AreaBoxSearchMatchesItemGeneralisation:
    """Present only when a `tier` was asked for.

    Attributes:
        parts (int | Unset):
        parts_at_full_resolution (int | Unset):
        vertices (int | Unset):
        vertices_at_full_resolution (int | Unset):
    """

    parts: int | Unset = UNSET
    parts_at_full_resolution: int | Unset = UNSET
    vertices: int | Unset = UNSET
    vertices_at_full_resolution: int | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        parts = self.parts

        parts_at_full_resolution = self.parts_at_full_resolution

        vertices = self.vertices

        vertices_at_full_resolution = self.vertices_at_full_resolution

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if parts is not UNSET:
            field_dict["parts"] = parts
        if parts_at_full_resolution is not UNSET:
            field_dict["partsAtFullResolution"] = parts_at_full_resolution
        if vertices is not UNSET:
            field_dict["vertices"] = vertices
        if vertices_at_full_resolution is not UNSET:
            field_dict["verticesAtFullResolution"] = vertices_at_full_resolution

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        parts = d.pop("parts", UNSET)

        parts_at_full_resolution = d.pop("partsAtFullResolution", UNSET)

        vertices = d.pop("vertices", UNSET)

        vertices_at_full_resolution = d.pop("verticesAtFullResolution", UNSET)

        area_box_search_matches_item_generalisation = cls(
            parts=parts,
            parts_at_full_resolution=parts_at_full_resolution,
            vertices=vertices,
            vertices_at_full_resolution=vertices_at_full_resolution,
        )

        area_box_search_matches_item_generalisation.additional_properties = d
        return area_box_search_matches_item_generalisation

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
