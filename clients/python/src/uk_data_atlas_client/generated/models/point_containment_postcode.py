from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.point_containment_postcode_status import PointContainmentPostcodeStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.point_containment_postcode_source import (
        PointContainmentPostcodeSource,
    )


T = TypeVar("T", bound="PointContainmentPostcode")


@_attrs_define
class PointContainmentPostcode:
    """Present when the point is a postcode's centroid.

    Attributes:
        href (str):
        postcode (str):
        source (PointContainmentPostcodeSource):
        status (PointContainmentPostcodeStatus):
        caution (str | Unset): Present when the directory does not state how accurate the centroid is.
    """

    href: str
    postcode: str
    source: PointContainmentPostcodeSource
    status: PointContainmentPostcodeStatus
    caution: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        href = self.href

        postcode = self.postcode

        source = self.source.to_dict()

        status = self.status.value

        caution = self.caution

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "href": href,
                "postcode": postcode,
                "source": source,
                "status": status,
            }
        )
        if caution is not UNSET:
            field_dict["caution"] = caution

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.point_containment_postcode_source import (
            PointContainmentPostcodeSource,
        )

        d = dict(src_dict)
        href = d.pop("href")

        postcode = d.pop("postcode")

        source = PointContainmentPostcodeSource.from_dict(d.pop("source"))

        status = PointContainmentPostcodeStatus(d.pop("status"))

        caution = d.pop("caution", UNSET)

        point_containment_postcode = cls(
            href=href,
            postcode=postcode,
            source=source,
            status=status,
            caution=caution,
        )

        point_containment_postcode.additional_properties = d
        return point_containment_postcode

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
