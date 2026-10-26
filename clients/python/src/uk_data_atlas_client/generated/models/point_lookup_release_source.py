from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.point_lookup_release_source_licence import (
        PointLookupReleaseSourceLicence,
    )


T = TypeVar("T", bound="PointLookupReleaseSource")


@_attrs_define
class PointLookupReleaseSource:
    """
    Attributes:
        licence (PointLookupReleaseSourceLicence | Unset):
        publisher (str | Unset):
    """

    licence: PointLookupReleaseSourceLicence | Unset = UNSET
    publisher: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        licence: dict[str, Any] | Unset = UNSET
        if not isinstance(self.licence, Unset):
            licence = self.licence.to_dict()

        publisher = self.publisher

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if licence is not UNSET:
            field_dict["licence"] = licence
        if publisher is not UNSET:
            field_dict["publisher"] = publisher

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.point_lookup_release_source_licence import (
            PointLookupReleaseSourceLicence,
        )

        d = dict(src_dict)
        _licence = d.pop("licence", UNSET)
        licence: PointLookupReleaseSourceLicence | Unset
        if isinstance(_licence, Unset):
            licence = UNSET
        else:
            licence = PointLookupReleaseSourceLicence.from_dict(_licence)

        publisher = d.pop("publisher", UNSET)

        point_lookup_release_source = cls(
            licence=licence,
            publisher=publisher,
        )

        point_lookup_release_source.additional_properties = d
        return point_lookup_release_source

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
