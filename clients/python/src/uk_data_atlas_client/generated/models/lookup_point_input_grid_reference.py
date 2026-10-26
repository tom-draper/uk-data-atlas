from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.lookup_point_input_grid_reference_position import (
    LookupPointInputGridReferencePosition,
)

T = TypeVar("T", bound="LookupPointInputGridReference")


@_attrs_define
class LookupPointInputGridReference:
    """Present when an Ordnance Survey National Grid reference was supplied.

    Attributes:
        cell_size_m (float):
        position (LookupPointInputGridReferencePosition):
        value (str):  Example: TQ 30000 80000.
    """

    cell_size_m: float
    position: LookupPointInputGridReferencePosition
    value: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        cell_size_m = self.cell_size_m

        position = self.position.value

        value = self.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cellSizeM": cell_size_m,
                "position": position,
                "value": value,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        cell_size_m = d.pop("cellSizeM")

        position = LookupPointInputGridReferencePosition(d.pop("position"))

        value = d.pop("value")

        lookup_point_input_grid_reference = cls(
            cell_size_m=cell_size_m,
            position=position,
            value=value,
        )

        lookup_point_input_grid_reference.additional_properties = d
        return lookup_point_input_grid_reference

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
