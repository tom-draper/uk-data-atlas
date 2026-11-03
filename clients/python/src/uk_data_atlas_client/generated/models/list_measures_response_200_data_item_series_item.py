from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.list_measures_response_200_data_item_series_item_dimensions import (
        ListMeasuresResponse200DataItemSeriesItemDimensions,
    )
    from ..models.list_measures_response_200_data_item_series_item_documents import (
        ListMeasuresResponse200DataItemSeriesItemDocuments,
    )
    from ..models.list_measures_response_200_data_item_series_item_sources_item import (
        ListMeasuresResponse200DataItemSeriesItemSourcesItem,
    )
    from ..models.list_measures_response_200_data_item_series_item_uncertainty import (
        ListMeasuresResponse200DataItemSeriesItemUncertainty,
    )


T = TypeVar("T", bound="ListMeasuresResponse200DataItemSeriesItem")


@_attrs_define
class ListMeasuresResponse200DataItemSeriesItem:
    """
    Attributes:
        dimensions (ListMeasuresResponse200DataItemSeriesItemDimensions):
        href (str):
        label (str):
        sources (list[ListMeasuresResponse200DataItemSeriesItemSourcesItem]):
        dataset_id (str | Unset):
        documents (ListMeasuresResponse200DataItemSeriesItemDocuments | Unset):
        notes (list[str] | Unset):
        uncertainty (ListMeasuresResponse200DataItemSeriesItemUncertainty | Unset):
        unit (str | Unset):
    """

    dimensions: ListMeasuresResponse200DataItemSeriesItemDimensions
    href: str
    label: str
    sources: list[ListMeasuresResponse200DataItemSeriesItemSourcesItem]
    dataset_id: str | Unset = UNSET
    documents: ListMeasuresResponse200DataItemSeriesItemDocuments | Unset = UNSET
    notes: list[str] | Unset = UNSET
    uncertainty: ListMeasuresResponse200DataItemSeriesItemUncertainty | Unset = UNSET
    unit: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        dimensions = self.dimensions.to_dict()

        href = self.href

        label = self.label

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)

        dataset_id = self.dataset_id

        documents: dict[str, Any] | Unset = UNSET
        if not isinstance(self.documents, Unset):
            documents = self.documents.to_dict()

        notes: list[str] | Unset = UNSET
        if not isinstance(self.notes, Unset):
            notes = self.notes

        uncertainty: dict[str, Any] | Unset = UNSET
        if not isinstance(self.uncertainty, Unset):
            uncertainty = self.uncertainty.to_dict()

        unit = self.unit

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "dimensions": dimensions,
                "href": href,
                "label": label,
                "sources": sources,
            }
        )
        if dataset_id is not UNSET:
            field_dict["datasetId"] = dataset_id
        if documents is not UNSET:
            field_dict["documents"] = documents
        if notes is not UNSET:
            field_dict["notes"] = notes
        if uncertainty is not UNSET:
            field_dict["uncertainty"] = uncertainty
        if unit is not UNSET:
            field_dict["unit"] = unit

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.list_measures_response_200_data_item_series_item_dimensions import (
            ListMeasuresResponse200DataItemSeriesItemDimensions,
        )
        from ..models.list_measures_response_200_data_item_series_item_documents import (
            ListMeasuresResponse200DataItemSeriesItemDocuments,
        )
        from ..models.list_measures_response_200_data_item_series_item_sources_item import (
            ListMeasuresResponse200DataItemSeriesItemSourcesItem,
        )
        from ..models.list_measures_response_200_data_item_series_item_uncertainty import (
            ListMeasuresResponse200DataItemSeriesItemUncertainty,
        )

        d = dict(src_dict)
        dimensions = ListMeasuresResponse200DataItemSeriesItemDimensions.from_dict(
            d.pop("dimensions")
        )

        href = d.pop("href")

        label = d.pop("label")

        sources = []
        _sources = d.pop("sources")
        for sources_item_data in _sources:
            sources_item = (
                ListMeasuresResponse200DataItemSeriesItemSourcesItem.from_dict(
                    sources_item_data
                )
            )

            sources.append(sources_item)

        dataset_id = d.pop("datasetId", UNSET)

        _documents = d.pop("documents", UNSET)
        documents: ListMeasuresResponse200DataItemSeriesItemDocuments | Unset
        if isinstance(_documents, Unset):
            documents = UNSET
        else:
            documents = ListMeasuresResponse200DataItemSeriesItemDocuments.from_dict(
                _documents
            )

        notes = cast(list[str], d.pop("notes", UNSET))

        _uncertainty = d.pop("uncertainty", UNSET)
        uncertainty: ListMeasuresResponse200DataItemSeriesItemUncertainty | Unset
        if isinstance(_uncertainty, Unset):
            uncertainty = UNSET
        else:
            uncertainty = (
                ListMeasuresResponse200DataItemSeriesItemUncertainty.from_dict(
                    _uncertainty
                )
            )

        unit = d.pop("unit", UNSET)

        list_measures_response_200_data_item_series_item = cls(
            dimensions=dimensions,
            href=href,
            label=label,
            sources=sources,
            dataset_id=dataset_id,
            documents=documents,
            notes=notes,
            uncertainty=uncertainty,
            unit=unit,
        )

        list_measures_response_200_data_item_series_item.additional_properties = d
        return list_measures_response_200_data_item_series_item

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
