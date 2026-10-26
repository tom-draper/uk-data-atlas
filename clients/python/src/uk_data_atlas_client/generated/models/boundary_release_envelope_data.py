from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.boundary_release_coverage import BoundaryReleaseCoverage
    from ..models.boundary_release_downloads_type_0 import BoundaryReleaseDownloadsType0
    from ..models.boundary_release_downloads_type_1 import BoundaryReleaseDownloadsType1
    from ..models.boundary_release_downloads_type_2 import BoundaryReleaseDownloadsType2
    from ..models.boundary_release_source import BoundaryReleaseSource


T = TypeVar("T", bound="BoundaryReleaseEnvelopeData")


@_attrs_define
class BoundaryReleaseEnvelopeData:
    """
    Attributes:
        coverage (BoundaryReleaseCoverage):
        geography (str):
        id (str):
        metadata_hash (str):
        source (BoundaryReleaseSource):
        title (str):
        downloads (BoundaryReleaseDownloadsType0 | BoundaryReleaseDownloadsType1 | BoundaryReleaseDownloadsType2): Where
            to get the whole release: its vector tiles, every generalisation tier as GeoParquet, and the `medium` and `low`
            tiers as GeoJSON. A release whose areas are not a coverage, because some edge lies on more than two of them,
            cannot be tiled or generalised with shared borders: it is `untiled`, with the reason, and downloadable whole as
            GeoParquet at `full` detail only. A release with no readable geometry is `unavailable`. Either stays available
            area by area.
        description (str | Unset):
        temporal_coverage (str | Unset):
    """

    coverage: BoundaryReleaseCoverage
    geography: str
    id: str
    metadata_hash: str
    source: BoundaryReleaseSource
    title: str
    downloads: (
        BoundaryReleaseDownloadsType0
        | BoundaryReleaseDownloadsType1
        | BoundaryReleaseDownloadsType2
    )
    description: str | Unset = UNSET
    temporal_coverage: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.boundary_release_downloads_type_0 import (
            BoundaryReleaseDownloadsType0,
        )
        from ..models.boundary_release_downloads_type_1 import (
            BoundaryReleaseDownloadsType1,
        )

        coverage = self.coverage.to_dict()

        geography = self.geography

        id = self.id

        metadata_hash = self.metadata_hash

        source = self.source.to_dict()

        title = self.title

        downloads: dict[str, Any]
        if isinstance(self.downloads, BoundaryReleaseDownloadsType0) or isinstance(
            self.downloads, BoundaryReleaseDownloadsType1
        ):
            downloads = self.downloads.to_dict()
        else:
            downloads = self.downloads.to_dict()

        description = self.description

        temporal_coverage = self.temporal_coverage

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "coverage": coverage,
                "geography": geography,
                "id": id,
                "metadataHash": metadata_hash,
                "source": source,
                "title": title,
                "downloads": downloads,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if temporal_coverage is not UNSET:
            field_dict["temporalCoverage"] = temporal_coverage

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.boundary_release_coverage import BoundaryReleaseCoverage
        from ..models.boundary_release_downloads_type_0 import (
            BoundaryReleaseDownloadsType0,
        )
        from ..models.boundary_release_downloads_type_1 import (
            BoundaryReleaseDownloadsType1,
        )
        from ..models.boundary_release_downloads_type_2 import (
            BoundaryReleaseDownloadsType2,
        )
        from ..models.boundary_release_source import BoundaryReleaseSource

        d = dict(src_dict)
        coverage = BoundaryReleaseCoverage.from_dict(d.pop("coverage"))

        geography = d.pop("geography")

        id = d.pop("id")

        metadata_hash = d.pop("metadataHash")

        source = BoundaryReleaseSource.from_dict(d.pop("source"))

        title = d.pop("title")

        def _parse_downloads(
            data: object,
        ) -> (
            BoundaryReleaseDownloadsType0
            | BoundaryReleaseDownloadsType1
            | BoundaryReleaseDownloadsType2
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_boundary_release_downloads_type_0 = (
                    BoundaryReleaseDownloadsType0.from_dict(data)
                )

                return componentsschemas_boundary_release_downloads_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_boundary_release_downloads_type_1 = (
                    BoundaryReleaseDownloadsType1.from_dict(data)
                )

                return componentsschemas_boundary_release_downloads_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_boundary_release_downloads_type_2 = (
                BoundaryReleaseDownloadsType2.from_dict(data)
            )

            return componentsschemas_boundary_release_downloads_type_2

        downloads = _parse_downloads(d.pop("downloads"))

        description = d.pop("description", UNSET)

        temporal_coverage = d.pop("temporalCoverage", UNSET)

        boundary_release_envelope_data = cls(
            coverage=coverage,
            geography=geography,
            id=id,
            metadata_hash=metadata_hash,
            source=source,
            title=title,
            downloads=downloads,
            description=description,
            temporal_coverage=temporal_coverage,
        )

        boundary_release_envelope_data.additional_properties = d
        return boundary_release_envelope_data

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
