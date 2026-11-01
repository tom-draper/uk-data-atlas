from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.compare_boundary_releases_response_200_data_published_relationships_item_direction import (
    CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemDirection,
)
from ..models.compare_boundary_releases_response_200_data_published_relationships_item_relationship_purpose import (
    CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemRelationshipPurpose,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMapping,
    )
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_0 import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType0,
    )
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_1 import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType1,
    )
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_2 import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType2,
    )
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_3 import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3,
    )


T = TypeVar(
    "T", bound="CompareBoundaryReleasesResponse200DataPublishedRelationshipsItem"
)


@_attrs_define
class CompareBoundaryReleasesResponse200DataPublishedRelationshipsItem:
    """
    Attributes:
        direction (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemDirection):
        id (str):
        mapping (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMapping):
        method (str):
        quality (str):
        record_count (int):
        weighting (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType0 |
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType1 |
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType2 |
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3):
        relationship_purpose (CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemRelationshipPurpose |
            Unset):
    """

    direction: CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemDirection
    id: str
    mapping: CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMapping
    method: str
    quality: str
    record_count: int
    weighting: (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType0
        | CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType1
        | CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType2
        | CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3
    )
    relationship_purpose: (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemRelationshipPurpose
        | Unset
    ) = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_0 import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType0,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_1 import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType1,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_2 import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType2,
        )

        direction = self.direction.value

        id = self.id

        mapping = self.mapping.to_dict()

        method = self.method

        quality = self.quality

        record_count = self.record_count

        weighting: dict[str, Any]
        if (
            isinstance(
                self.weighting,
                CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType0,
            )
            or isinstance(
                self.weighting,
                CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType1,
            )
            or isinstance(
                self.weighting,
                CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType2,
            )
        ):
            weighting = self.weighting.to_dict()
        else:
            weighting = self.weighting.to_dict()

        relationship_purpose: str | Unset = UNSET
        if not isinstance(self.relationship_purpose, Unset):
            relationship_purpose = self.relationship_purpose.value

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "direction": direction,
                "id": id,
                "mapping": mapping,
                "method": method,
                "quality": quality,
                "recordCount": record_count,
                "weighting": weighting,
            }
        )
        if relationship_purpose is not UNSET:
            field_dict["relationshipPurpose"] = relationship_purpose

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_mapping import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMapping,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_0 import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType0,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_1 import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType1,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_2 import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType2,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item_weighting_type_3 import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3,
        )

        d = dict(src_dict)
        direction = (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemDirection(
                d.pop("direction")
            )
        )

        id = d.pop("id")

        mapping = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemMapping.from_dict(
            d.pop("mapping")
        )

        method = d.pop("method")

        quality = d.pop("quality")

        record_count = d.pop("recordCount")

        def _parse_weighting(
            data: object,
        ) -> (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType0
            | CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType1
            | CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType2
            | CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                weighting_type_0 = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType0.from_dict(
                    data
                )

                return weighting_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                weighting_type_1 = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType1.from_dict(
                    data
                )

                return weighting_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                weighting_type_2 = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType2.from_dict(
                    data
                )

                return weighting_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            weighting_type_3 = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemWeightingType3.from_dict(
                data
            )

            return weighting_type_3

        weighting = _parse_weighting(d.pop("weighting"))

        _relationship_purpose = d.pop("relationshipPurpose", UNSET)
        relationship_purpose: (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemRelationshipPurpose
            | Unset
        )
        if isinstance(_relationship_purpose, Unset):
            relationship_purpose = UNSET
        else:
            relationship_purpose = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItemRelationshipPurpose(
                _relationship_purpose
            )

        compare_boundary_releases_response_200_data_published_relationships_item = cls(
            direction=direction,
            id=id,
            mapping=mapping,
            method=method,
            quality=quality,
            record_count=record_count,
            weighting=weighting,
            relationship_purpose=relationship_purpose,
        )

        compare_boundary_releases_response_200_data_published_relationships_item.additional_properties = d
        return compare_boundary_releases_response_200_data_published_relationships_item

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
