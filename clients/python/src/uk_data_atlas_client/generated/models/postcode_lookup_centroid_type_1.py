from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.postcode_lookup_centroid_type_1_crs import PostcodeLookupCentroidType1Crs

if TYPE_CHECKING:
    from ..models.postcode_lookup_centroid_type_1_positional_quality import (
        PostcodeLookupCentroidType1PositionalQuality,
    )


T = TypeVar("T", bound="PostcodeLookupCentroidType1")


@_attrs_define
class PostcodeLookupCentroidType1:
    """
    Attributes:
        crs (PostcodeLookupCentroidType1Crs):
        easting (int):
        northing (int):
        positional_quality (PostcodeLookupCentroidType1PositionalQuality):
    """

    crs: PostcodeLookupCentroidType1Crs
    easting: int
    northing: int
    positional_quality: PostcodeLookupCentroidType1PositionalQuality
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        crs = self.crs.value

        easting = self.easting

        northing = self.northing

        positional_quality = self.positional_quality.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "crs": crs,
                "easting": easting,
                "northing": northing,
                "positionalQuality": positional_quality,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.postcode_lookup_centroid_type_1_positional_quality import (
            PostcodeLookupCentroidType1PositionalQuality,
        )

        d = dict(src_dict)
        crs = PostcodeLookupCentroidType1Crs(d.pop("crs"))

        easting = d.pop("easting")

        northing = d.pop("northing")

        positional_quality = PostcodeLookupCentroidType1PositionalQuality.from_dict(
            d.pop("positionalQuality")
        )

        postcode_lookup_centroid_type_1 = cls(
            crs=crs,
            easting=easting,
            northing=northing,
            positional_quality=positional_quality,
        )

        postcode_lookup_centroid_type_1.additional_properties = d
        return postcode_lookup_centroid_type_1

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
