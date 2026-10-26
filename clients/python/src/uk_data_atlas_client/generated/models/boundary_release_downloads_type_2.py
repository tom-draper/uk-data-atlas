from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.boundary_release_downloads_type_2_status import (
    BoundaryReleaseDownloadsType2Status,
)

T = TypeVar("T", bound="BoundaryReleaseDownloadsType2")


@_attrs_define
class BoundaryReleaseDownloadsType2:
    """
    Attributes:
        reason (str):
        status (BoundaryReleaseDownloadsType2Status):
    """

    reason: str
    status: BoundaryReleaseDownloadsType2Status
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        reason = self.reason

        status = self.status.value

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

        status = BoundaryReleaseDownloadsType2Status(d.pop("status"))

        boundary_release_downloads_type_2 = cls(
            reason=reason,
            status=status,
        )

        boundary_release_downloads_type_2.additional_properties = d
        return boundary_release_downloads_type_2

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
