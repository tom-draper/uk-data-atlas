from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.geometry_validity_type_1_status import GeometryValidityType1Status
from ..types import UNSET, Unset

T = TypeVar("T", bound="GeometryValidityType1")


@_attrs_define
class GeometryValidityType1:
    """
    Attributes:
        status (GeometryValidityType1Status | Unset):
    """

    status: GeometryValidityType1Status | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if status is not UNSET:
            field_dict["status"] = status

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        _status = d.pop("status", UNSET)
        status: GeometryValidityType1Status | Unset
        if isinstance(_status, Unset):
            status = UNSET
        else:
            status = GeometryValidityType1Status(_status)

        geometry_validity_type_1 = cls(
            status=status,
        )

        geometry_validity_type_1.additional_properties = d
        return geometry_validity_type_1

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
