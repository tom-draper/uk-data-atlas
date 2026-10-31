from __future__ import annotations

from collections.abc import Mapping
from typing import (
    Any,
    Literal,
    Self,
    TypeVar,
    cast,
)

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="CompareBoundaryReleasesResponse200DataContinuityType0")


@_attrs_define
class CompareBoundaryReleasesResponse200DataContinuityType0:
    """
    Attributes:
        reason (str):
        status (Literal['not-published']):
    """

    reason: str
    status: Literal["not-published"]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        reason = self.reason

        status = self.status

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "reason": reason,
                "status": status,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        reason = d.pop("reason")

        status = cast(Literal["not-published"], d.pop("status"))
        if status != "not-published":
            raise ValueError(f"status must match const 'not-published', got '{status}'")

        compare_boundary_releases_response_200_data_continuity_type_0 = cls(
            reason=reason,
            status=status,
        )

        compare_boundary_releases_response_200_data_continuity_type_0.additional_properties = d
        return compare_boundary_releases_response_200_data_continuity_type_0

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
