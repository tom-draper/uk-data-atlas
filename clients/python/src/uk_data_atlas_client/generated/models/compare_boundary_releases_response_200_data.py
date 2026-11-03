from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.compare_boundary_releases_response_200_data_codes import (
        CompareBoundaryReleasesResponse200DataCodes,
    )
    from ..models.compare_boundary_releases_response_200_data_continuity_type_0 import (
        CompareBoundaryReleasesResponse200DataContinuityType0,
    )
    from ..models.compare_boundary_releases_response_200_data_continuity_type_1 import (
        CompareBoundaryReleasesResponse200DataContinuityType1,
    )
    from ..models.compare_boundary_releases_response_200_data_from import (
        CompareBoundaryReleasesResponse200DataFrom,
    )
    from ..models.compare_boundary_releases_response_200_data_published_relationships_item import (
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItem,
    )
    from ..models.compare_boundary_releases_response_200_data_summary import (
        CompareBoundaryReleasesResponse200DataSummary,
    )
    from ..models.compare_boundary_releases_response_200_data_to import (
        CompareBoundaryReleasesResponse200DataTo,
    )


T = TypeVar("T", bound="CompareBoundaryReleasesResponse200Data")


@_attrs_define
class CompareBoundaryReleasesResponse200Data:
    """
    Attributes:
        codes (CompareBoundaryReleasesResponse200DataCodes):
        continuity (CompareBoundaryReleasesResponse200DataContinuityType0 |
            CompareBoundaryReleasesResponse200DataContinuityType1):
        from_ (CompareBoundaryReleasesResponse200DataFrom):
        geography (str):
        limit (int):
        note (str):
        published_relationships (list[CompareBoundaryReleasesResponse200DataPublishedRelationshipsItem]):
        summary (CompareBoundaryReleasesResponse200DataSummary):
        to (CompareBoundaryReleasesResponse200DataTo):
    """

    codes: CompareBoundaryReleasesResponse200DataCodes
    continuity: (
        CompareBoundaryReleasesResponse200DataContinuityType0
        | CompareBoundaryReleasesResponse200DataContinuityType1
    )
    from_: CompareBoundaryReleasesResponse200DataFrom
    geography: str
    limit: int
    note: str
    published_relationships: list[
        CompareBoundaryReleasesResponse200DataPublishedRelationshipsItem
    ]
    summary: CompareBoundaryReleasesResponse200DataSummary
    to: CompareBoundaryReleasesResponse200DataTo
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.compare_boundary_releases_response_200_data_continuity_type_0 import (
            CompareBoundaryReleasesResponse200DataContinuityType0,
        )

        codes = self.codes.to_dict()

        continuity: dict[str, Any]
        if isinstance(
            self.continuity, CompareBoundaryReleasesResponse200DataContinuityType0
        ):
            continuity = self.continuity.to_dict()
        else:
            continuity = self.continuity.to_dict()

        from_ = self.from_.to_dict()

        geography = self.geography

        limit = self.limit

        note = self.note

        published_relationships = []
        for published_relationships_item_data in self.published_relationships:
            published_relationships_item = published_relationships_item_data.to_dict()
            published_relationships.append(published_relationships_item)

        summary = self.summary.to_dict()

        to = self.to.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "codes": codes,
                "continuity": continuity,
                "from": from_,
                "geography": geography,
                "limit": limit,
                "note": note,
                "publishedRelationships": published_relationships,
                "summary": summary,
                "to": to,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.compare_boundary_releases_response_200_data_codes import (
            CompareBoundaryReleasesResponse200DataCodes,
        )
        from ..models.compare_boundary_releases_response_200_data_continuity_type_0 import (
            CompareBoundaryReleasesResponse200DataContinuityType0,
        )
        from ..models.compare_boundary_releases_response_200_data_continuity_type_1 import (
            CompareBoundaryReleasesResponse200DataContinuityType1,
        )
        from ..models.compare_boundary_releases_response_200_data_from import (
            CompareBoundaryReleasesResponse200DataFrom,
        )
        from ..models.compare_boundary_releases_response_200_data_published_relationships_item import (
            CompareBoundaryReleasesResponse200DataPublishedRelationshipsItem,
        )
        from ..models.compare_boundary_releases_response_200_data_summary import (
            CompareBoundaryReleasesResponse200DataSummary,
        )
        from ..models.compare_boundary_releases_response_200_data_to import (
            CompareBoundaryReleasesResponse200DataTo,
        )

        d = dict(src_dict)
        codes = CompareBoundaryReleasesResponse200DataCodes.from_dict(d.pop("codes"))

        def _parse_continuity(
            data: object,
        ) -> (
            CompareBoundaryReleasesResponse200DataContinuityType0
            | CompareBoundaryReleasesResponse200DataContinuityType1
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                continuity_type_0 = (
                    CompareBoundaryReleasesResponse200DataContinuityType0.from_dict(
                        data
                    )
                )

                return continuity_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            continuity_type_1 = (
                CompareBoundaryReleasesResponse200DataContinuityType1.from_dict(data)
            )

            return continuity_type_1

        continuity = _parse_continuity(d.pop("continuity"))

        from_ = CompareBoundaryReleasesResponse200DataFrom.from_dict(d.pop("from"))

        geography = d.pop("geography")

        limit = d.pop("limit")

        note = d.pop("note")

        published_relationships = []
        _published_relationships = d.pop("publishedRelationships")
        for published_relationships_item_data in _published_relationships:
            published_relationships_item = CompareBoundaryReleasesResponse200DataPublishedRelationshipsItem.from_dict(
                published_relationships_item_data
            )

            published_relationships.append(published_relationships_item)

        summary = CompareBoundaryReleasesResponse200DataSummary.from_dict(
            d.pop("summary")
        )

        to = CompareBoundaryReleasesResponse200DataTo.from_dict(d.pop("to"))

        compare_boundary_releases_response_200_data = cls(
            codes=codes,
            continuity=continuity,
            from_=from_,
            geography=geography,
            limit=limit,
            note=note,
            published_relationships=published_relationships,
            summary=summary,
            to=to,
        )

        compare_boundary_releases_response_200_data.additional_properties = d
        return compare_boundary_releases_response_200_data

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
