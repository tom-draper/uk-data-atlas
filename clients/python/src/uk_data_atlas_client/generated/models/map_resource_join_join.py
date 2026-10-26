from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.map_resource_join_join_method import MapResourceJoinJoinMethod

T = TypeVar("T", bound="MapResourceJoinJoin")


@_attrs_define
class MapResourceJoinJoin:
    """
    Attributes:
        boundary_release (str):
        compatibility (str): The code-set status the join was accepted on.
        method (MapResourceJoinJoinMethod): Codes are matched. No value is converted.
        note (str):
    """

    boundary_release: str
    compatibility: str
    method: MapResourceJoinJoinMethod
    note: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        boundary_release = self.boundary_release

        compatibility = self.compatibility

        method = self.method.value

        note = self.note

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "boundaryRelease": boundary_release,
                "compatibility": compatibility,
                "method": method,
                "note": note,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        boundary_release = d.pop("boundaryRelease")

        compatibility = d.pop("compatibility")

        method = MapResourceJoinJoinMethod(d.pop("method"))

        note = d.pop("note")

        map_resource_join_join = cls(
            boundary_release=boundary_release,
            compatibility=compatibility,
            method=method,
            note=note,
        )

        map_resource_join_join.additional_properties = d
        return map_resource_join_join

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
