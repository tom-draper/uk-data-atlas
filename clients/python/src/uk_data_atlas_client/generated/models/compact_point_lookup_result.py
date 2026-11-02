from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.compact_point_lookup_result_status import CompactPointLookupResultStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.compact_point_lookup_result_matches_item import (
        CompactPointLookupResultMatchesItem,
    )


T = TypeVar("T", bound="CompactPointLookupResult")


@_attrs_define
class CompactPointLookupResult:
    """
    Attributes:
        geography (str):
        matches (list[CompactPointLookupResultMatchesItem]):
        status (CompactPointLookupResultStatus):
        boundary_release (str | Unset):
        detail (str | Unset):
    """

    geography: str
    matches: list[CompactPointLookupResultMatchesItem]
    status: CompactPointLookupResultStatus
    boundary_release: str | Unset = UNSET
    detail: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        geography = self.geography

        matches = []
        for matches_item_data in self.matches:
            matches_item = matches_item_data.to_dict()
            matches.append(matches_item)

        status = self.status.value

        boundary_release = self.boundary_release

        detail = self.detail

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "geography": geography,
                "matches": matches,
                "status": status,
            }
        )
        if boundary_release is not UNSET:
            field_dict["boundaryRelease"] = boundary_release
        if detail is not UNSET:
            field_dict["detail"] = detail

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compact_point_lookup_result_matches_item import (
            CompactPointLookupResultMatchesItem,
        )

        d = dict(src_dict)
        geography = d.pop("geography")

        matches = []
        _matches = d.pop("matches")
        for matches_item_data in _matches:
            matches_item = CompactPointLookupResultMatchesItem.from_dict(
                matches_item_data
            )

            matches.append(matches_item)

        status = CompactPointLookupResultStatus(d.pop("status"))

        boundary_release = d.pop("boundaryRelease", UNSET)

        detail = d.pop("detail", UNSET)

        compact_point_lookup_result = cls(
            geography=geography,
            matches=matches,
            status=status,
            boundary_release=boundary_release,
            detail=detail,
        )

        compact_point_lookup_result.additional_properties = d
        return compact_point_lookup_result

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
