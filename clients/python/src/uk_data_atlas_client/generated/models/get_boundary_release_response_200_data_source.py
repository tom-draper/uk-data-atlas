from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.get_boundary_release_response_200_data_source_licence import (
        GetBoundaryReleaseResponse200DataSourceLicence,
    )


T = TypeVar("T", bound="GetBoundaryReleaseResponse200DataSource")


@_attrs_define
class GetBoundaryReleaseResponse200DataSource:
    """
    Attributes:
        licence (GetBoundaryReleaseResponse200DataSourceLicence):
        publisher (str):
        url (str):
        retrieved_at (datetime.date | Unset):
    """

    licence: GetBoundaryReleaseResponse200DataSourceLicence
    publisher: str
    url: str
    retrieved_at: datetime.date | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        licence = self.licence.to_dict()

        publisher = self.publisher

        url = self.url

        retrieved_at: str | Unset = UNSET
        if not isinstance(self.retrieved_at, Unset):
            retrieved_at = self.retrieved_at.isoformat()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "licence": licence,
                "publisher": publisher,
                "url": url,
            }
        )
        if retrieved_at is not UNSET:
            field_dict["retrievedAt"] = retrieved_at

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.get_boundary_release_response_200_data_source_licence import (
            GetBoundaryReleaseResponse200DataSourceLicence,
        )

        d = dict(src_dict)
        licence = GetBoundaryReleaseResponse200DataSourceLicence.from_dict(
            d.pop("licence")
        )

        publisher = d.pop("publisher")

        url = d.pop("url")

        _retrieved_at = d.pop("retrievedAt", UNSET)
        retrieved_at: datetime.date | Unset
        if isinstance(_retrieved_at, Unset):
            retrieved_at = UNSET
        else:
            retrieved_at = datetime.date.fromisoformat(_retrieved_at)

        get_boundary_release_response_200_data_source = cls(
            licence=licence,
            publisher=publisher,
            url=url,
            retrieved_at=retrieved_at,
        )

        get_boundary_release_response_200_data_source.additional_properties = d
        return get_boundary_release_response_200_data_source

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
