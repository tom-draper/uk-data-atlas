from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.compact_postcode_batch_releases_item_status import (
    CompactPostcodeBatchReleasesItemStatus,
)
from ..types import UNSET, Unset

T = TypeVar("T", bound="CompactPostcodeBatchReleasesItem")


@_attrs_define
class CompactPostcodeBatchReleasesItem:
    """
    Attributes:
        geography (str):
        boundary_release (str | Unset):
        detail (str | Unset):
        status (CompactPostcodeBatchReleasesItemStatus | Unset):
    """

    geography: str
    boundary_release: str | Unset = UNSET
    detail: str | Unset = UNSET
    status: CompactPostcodeBatchReleasesItemStatus | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geography = self.geography

        boundary_release = self.boundary_release

        detail = self.detail

        status: str | Unset = UNSET
        if not isinstance(self.status, Unset):
            status = self.status.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "geography": geography,
            }
        )
        if boundary_release is not UNSET:
            field_dict["boundaryRelease"] = boundary_release
        if detail is not UNSET:
            field_dict["detail"] = detail
        if status is not UNSET:
            field_dict["status"] = status

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        geography = d.pop("geography")

        boundary_release = d.pop("boundaryRelease", UNSET)

        detail = d.pop("detail", UNSET)

        _status = d.pop("status", UNSET)
        status: CompactPostcodeBatchReleasesItemStatus | Unset
        if isinstance(_status, Unset):
            status = UNSET
        else:
            status = CompactPostcodeBatchReleasesItemStatus(_status)

        compact_postcode_batch_releases_item = cls(
            geography=geography,
            boundary_release=boundary_release,
            detail=detail,
            status=status,
        )

        compact_postcode_batch_releases_item.additional_properties = d
        return compact_postcode_batch_releases_item

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
