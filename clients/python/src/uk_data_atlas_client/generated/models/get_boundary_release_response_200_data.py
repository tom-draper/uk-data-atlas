from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.get_boundary_release_response_200_data_coverage import (
        GetBoundaryReleaseResponse200DataCoverage,
    )
    from ..models.get_boundary_release_response_200_data_deprecation import (
        GetBoundaryReleaseResponse200DataDeprecation,
    )
    from ..models.get_boundary_release_response_200_data_documents import (
        GetBoundaryReleaseResponse200DataDocuments,
    )
    from ..models.get_boundary_release_response_200_data_downloads_type_0 import (
        GetBoundaryReleaseResponse200DataDownloadsType0,
    )
    from ..models.get_boundary_release_response_200_data_downloads_type_1 import (
        GetBoundaryReleaseResponse200DataDownloadsType1,
    )
    from ..models.get_boundary_release_response_200_data_downloads_type_2 import (
        GetBoundaryReleaseResponse200DataDownloadsType2,
    )
    from ..models.get_boundary_release_response_200_data_source import (
        GetBoundaryReleaseResponse200DataSource,
    )


T = TypeVar("T", bound="GetBoundaryReleaseResponse200Data")


@_attrs_define
class GetBoundaryReleaseResponse200Data:
    """
    Attributes:
        coverage (GetBoundaryReleaseResponse200DataCoverage):
        documents (GetBoundaryReleaseResponse200DataDocuments):
        downloads (GetBoundaryReleaseResponse200DataDownloadsType0 | GetBoundaryReleaseResponse200DataDownloadsType1 |
            GetBoundaryReleaseResponse200DataDownloadsType2): Where to get the whole release. Available releases have vector
            tiles and GeoParquet downloads. Untiled releases have GeoParquet at full detail only. Unavailable releases have
            no readable geometry. Each remains available area by area.
        geography (str):
        id (str):
        metadata_hash (str):
        source (GetBoundaryReleaseResponse200DataSource):
        title (str):
        deprecation (GetBoundaryReleaseResponse200DataDeprecation | Unset): Present on a release that has been
            superseded. The release stays published and is not chosen by date or `latest` while its replacement covers the
            date; clients should move to `replacedBy` before `sunset`.
        description (str | Unset):
        temporal_coverage (str | Unset):
    """

    coverage: GetBoundaryReleaseResponse200DataCoverage
    documents: GetBoundaryReleaseResponse200DataDocuments
    downloads: (
        GetBoundaryReleaseResponse200DataDownloadsType0
        | GetBoundaryReleaseResponse200DataDownloadsType1
        | GetBoundaryReleaseResponse200DataDownloadsType2
    )
    geography: str
    id: str
    metadata_hash: str
    source: GetBoundaryReleaseResponse200DataSource
    title: str
    deprecation: GetBoundaryReleaseResponse200DataDeprecation | Unset = UNSET
    description: str | Unset = UNSET
    temporal_coverage: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        from ..models.get_boundary_release_response_200_data_downloads_type_0 import (
            GetBoundaryReleaseResponse200DataDownloadsType0,
        )
        from ..models.get_boundary_release_response_200_data_downloads_type_1 import (
            GetBoundaryReleaseResponse200DataDownloadsType1,
        )

        coverage = self.coverage.to_dict()

        documents = self.documents.to_dict()

        downloads: dict[str, Any]
        if isinstance(
            self.downloads, GetBoundaryReleaseResponse200DataDownloadsType0
        ) or isinstance(
            self.downloads, GetBoundaryReleaseResponse200DataDownloadsType1
        ):
            downloads = self.downloads.to_dict()
        else:
            downloads = self.downloads.to_dict()

        geography = self.geography

        id = self.id

        metadata_hash = self.metadata_hash

        source = self.source.to_dict()

        title = self.title

        deprecation: dict[str, Any] | Unset = UNSET
        if not isinstance(self.deprecation, Unset):
            deprecation = self.deprecation.to_dict()

        description = self.description

        temporal_coverage = self.temporal_coverage

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "coverage": coverage,
                "documents": documents,
                "downloads": downloads,
                "geography": geography,
                "id": id,
                "metadataHash": metadata_hash,
                "source": source,
                "title": title,
            }
        )
        if deprecation is not UNSET:
            field_dict["deprecation"] = deprecation
        if description is not UNSET:
            field_dict["description"] = description
        if temporal_coverage is not UNSET:
            field_dict["temporalCoverage"] = temporal_coverage

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.get_boundary_release_response_200_data_coverage import (
            GetBoundaryReleaseResponse200DataCoverage,
        )
        from ..models.get_boundary_release_response_200_data_deprecation import (
            GetBoundaryReleaseResponse200DataDeprecation,
        )
        from ..models.get_boundary_release_response_200_data_documents import (
            GetBoundaryReleaseResponse200DataDocuments,
        )
        from ..models.get_boundary_release_response_200_data_downloads_type_0 import (
            GetBoundaryReleaseResponse200DataDownloadsType0,
        )
        from ..models.get_boundary_release_response_200_data_downloads_type_1 import (
            GetBoundaryReleaseResponse200DataDownloadsType1,
        )
        from ..models.get_boundary_release_response_200_data_downloads_type_2 import (
            GetBoundaryReleaseResponse200DataDownloadsType2,
        )
        from ..models.get_boundary_release_response_200_data_source import (
            GetBoundaryReleaseResponse200DataSource,
        )

        d = dict(src_dict)
        coverage = GetBoundaryReleaseResponse200DataCoverage.from_dict(
            d.pop("coverage")
        )

        documents = GetBoundaryReleaseResponse200DataDocuments.from_dict(
            d.pop("documents")
        )

        def _parse_downloads(
            data: object,
        ) -> (
            GetBoundaryReleaseResponse200DataDownloadsType0
            | GetBoundaryReleaseResponse200DataDownloadsType1
            | GetBoundaryReleaseResponse200DataDownloadsType2
        ):
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                downloads_type_0 = (
                    GetBoundaryReleaseResponse200DataDownloadsType0.from_dict(data)
                )

                return downloads_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                downloads_type_1 = (
                    GetBoundaryReleaseResponse200DataDownloadsType1.from_dict(data)
                )

                return downloads_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            downloads_type_2 = (
                GetBoundaryReleaseResponse200DataDownloadsType2.from_dict(data)
            )

            return downloads_type_2

        downloads = _parse_downloads(d.pop("downloads"))

        geography = d.pop("geography")

        id = d.pop("id")

        metadata_hash = d.pop("metadataHash")

        source = GetBoundaryReleaseResponse200DataSource.from_dict(d.pop("source"))

        title = d.pop("title")

        _deprecation = d.pop("deprecation", UNSET)
        deprecation: GetBoundaryReleaseResponse200DataDeprecation | Unset
        if isinstance(_deprecation, Unset):
            deprecation = UNSET
        else:
            deprecation = GetBoundaryReleaseResponse200DataDeprecation.from_dict(
                _deprecation
            )

        description = d.pop("description", UNSET)

        temporal_coverage = d.pop("temporalCoverage", UNSET)

        get_boundary_release_response_200_data = cls(
            coverage=coverage,
            documents=documents,
            downloads=downloads,
            geography=geography,
            id=id,
            metadata_hash=metadata_hash,
            source=source,
            title=title,
            deprecation=deprecation,
            description=description,
            temporal_coverage=temporal_coverage,
        )

        get_boundary_release_response_200_data.additional_properties = d
        return get_boundary_release_response_200_data

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
