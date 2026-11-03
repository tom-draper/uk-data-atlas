from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_lookup_result_reason import PointLookupResultReason
from ..models.point_lookup_result_status import PointLookupResultStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.point_lookup_result_matches_item import PointLookupResultMatchesItem


T = TypeVar("T", bound="PointLookupResult")


@_attrs_define
class PointLookupResult:
    """
    Attributes:
        geography (str):
        matches (list[PointLookupResultMatchesItem]):
        status (PointLookupResultStatus):
        boundary_release (str | Unset):
        detail (str | Unset):
        positional_tolerance_m (float | Unset): Coordinate uncertainty, boundary generalisation and transformation
            accuracy added together, in metres.
        reason (PointLookupResultReason | Unset):
    """

    geography: str
    matches: list[PointLookupResultMatchesItem]
    status: PointLookupResultStatus
    boundary_release: str | Unset = UNSET
    detail: str | Unset = UNSET
    positional_tolerance_m: float | Unset = UNSET
    reason: PointLookupResultReason | Unset = UNSET
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

        positional_tolerance_m = self.positional_tolerance_m

        reason: str | Unset = UNSET
        if not isinstance(self.reason, Unset):
            reason = self.reason.value

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
        if positional_tolerance_m is not UNSET:
            field_dict["positionalToleranceM"] = positional_tolerance_m
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.point_lookup_result_matches_item import (
            PointLookupResultMatchesItem,
        )

        d = dict(src_dict)
        geography = d.pop("geography")

        matches = []
        _matches = d.pop("matches")
        for matches_item_data in _matches:
            matches_item = PointLookupResultMatchesItem.from_dict(matches_item_data)

            matches.append(matches_item)

        status = PointLookupResultStatus(d.pop("status"))

        boundary_release = d.pop("boundaryRelease", UNSET)

        detail = d.pop("detail", UNSET)

        positional_tolerance_m = d.pop("positionalToleranceM", UNSET)

        _reason = d.pop("reason", UNSET)
        reason: PointLookupResultReason | Unset
        if isinstance(_reason, Unset):
            reason = UNSET
        else:
            reason = PointLookupResultReason(_reason)

        point_lookup_result = cls(
            geography=geography,
            matches=matches,
            status=status,
            boundary_release=boundary_release,
            detail=detail,
            positional_tolerance_m=positional_tolerance_m,
            reason=reason,
        )

        point_lookup_result.additional_properties = d
        return point_lookup_result

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
