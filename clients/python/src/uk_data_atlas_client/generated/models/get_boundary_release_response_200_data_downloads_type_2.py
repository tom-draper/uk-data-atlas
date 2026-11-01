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

T = TypeVar("T", bound="GetBoundaryReleaseResponse200DataDownloadsType2")


@_attrs_define
class GetBoundaryReleaseResponse200DataDownloadsType2:
    """
    Attributes:
        reason (str):
        status (Literal['unavailable']):
    """

    reason: str
    status: Literal["unavailable"]
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

        status = cast(Literal["unavailable"], d.pop("status"))
        if status != "unavailable":
            raise ValueError(f"status must match const 'unavailable', got '{status}'")

        get_boundary_release_response_200_data_downloads_type_2 = cls(
            reason=reason,
            status=status,
        )

        get_boundary_release_response_200_data_downloads_type_2.additional_properties = d
        return get_boundary_release_response_200_data_downloads_type_2

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
