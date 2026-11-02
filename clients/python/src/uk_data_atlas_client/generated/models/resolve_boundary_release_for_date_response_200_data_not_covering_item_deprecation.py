from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

T = TypeVar(
    "T", bound="ResolveBoundaryReleaseForDateResponse200DataNotCoveringItemDeprecation"
)


@_attrs_define
class ResolveBoundaryReleaseForDateResponse200DataNotCoveringItemDeprecation:
    """Present on a release that has been superseded. The release stays published and is not chosen by date or `latest`
    while its replacement covers the date; clients should move to `replacedBy` before `sunset`.

        Attributes:
            deprecated (datetime.date): The date the release was deprecated.
            reason (str):
            replaced_by (str): The id of the release, of the same geography, to use instead.
            sunset (datetime.date | Unset): The date after which the release may be removed. Absent until one is set.
    """

    deprecated: datetime.date
    reason: str
    replaced_by: str
    sunset: datetime.date | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        deprecated = self.deprecated.isoformat()

        reason = self.reason

        replaced_by = self.replaced_by

        sunset: str | Unset = UNSET
        if not isinstance(self.sunset, Unset):
            sunset = self.sunset.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "deprecated": deprecated,
                "reason": reason,
                "replacedBy": replaced_by,
            }
        )
        if sunset is not UNSET:
            field_dict["sunset"] = sunset

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        d = dict(src_dict)
        deprecated = datetime.date.fromisoformat(d.pop("deprecated"))

        reason = d.pop("reason")

        replaced_by = d.pop("replacedBy")

        _sunset = d.pop("sunset", UNSET)
        sunset: datetime.date | Unset
        if isinstance(_sunset, Unset):
            sunset = UNSET
        else:
            sunset = datetime.date.fromisoformat(_sunset)

        resolve_boundary_release_for_date_response_200_data_not_covering_item_deprecation = cls(
            deprecated=deprecated,
            reason=reason,
            replaced_by=replaced_by,
            sunset=sunset,
        )

        resolve_boundary_release_for_date_response_200_data_not_covering_item_deprecation.additional_properties = d
        return resolve_boundary_release_for_date_response_200_data_not_covering_item_deprecation

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
