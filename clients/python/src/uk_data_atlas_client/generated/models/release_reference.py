from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.boundary_release_deprecation import BoundaryReleaseDeprecation


T = TypeVar("T", bound="ReleaseReference")


@_attrs_define
class ReleaseReference:
    """
    Attributes:
        countries (list[str]):
        href (str):
        id (str):
        month (str):
        title (str):
        deprecation (BoundaryReleaseDeprecation | Unset): Present on a release that has been superseded. The release
            stays published and is not chosen by date or `latest` while its replacement covers the date; clients should move
            to `replacedBy` before `sunset`.
    """

    countries: list[str]
    href: str
    id: str
    month: str
    title: str
    deprecation: BoundaryReleaseDeprecation | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        countries = self.countries

        href = self.href

        id = self.id

        month = self.month

        title = self.title

        deprecation: dict[str, Any] | Unset = UNSET
        if not isinstance(self.deprecation, Unset):
            deprecation = self.deprecation.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "countries": countries,
                "href": href,
                "id": id,
                "month": month,
                "title": title,
            }
        )
        if deprecation is not UNSET:
            field_dict["deprecation"] = deprecation

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.boundary_release_deprecation import BoundaryReleaseDeprecation

        d = dict(src_dict)
        countries = cast(list[str], d.pop("countries"))

        href = d.pop("href")

        id = d.pop("id")

        month = d.pop("month")

        title = d.pop("title")

        _deprecation = d.pop("deprecation", UNSET)
        deprecation: BoundaryReleaseDeprecation | Unset
        if isinstance(_deprecation, Unset):
            deprecation = UNSET
        else:
            deprecation = BoundaryReleaseDeprecation.from_dict(_deprecation)

        release_reference = cls(
            countries=countries,
            href=href,
            id=id,
            month=month,
            title=title,
            deprecation=deprecation,
        )

        release_reference.additional_properties = d
        return release_reference

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
