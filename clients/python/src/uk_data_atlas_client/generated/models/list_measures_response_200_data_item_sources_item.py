from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.list_measures_response_200_data_item_sources_item_coverage import (
        ListMeasuresResponse200DataItemSourcesItemCoverage,
    )
    from ..models.list_measures_response_200_data_item_sources_item_source_geography import (
        ListMeasuresResponse200DataItemSourcesItemSourceGeography,
    )


T = TypeVar("T", bound="ListMeasuresResponse200DataItemSourcesItem")


@_attrs_define
class ListMeasuresResponse200DataItemSourcesItem:
    """
    Attributes:
        coverage (ListMeasuresResponse200DataItemSourcesItemCoverage):
        dataset_id (str):
        periods (list[str]):
        source_geography (ListMeasuresResponse200DataItemSourcesItemSourceGeography):
        observation_artifact (str | Unset):
    """

    coverage: ListMeasuresResponse200DataItemSourcesItemCoverage
    dataset_id: str
    periods: list[str]
    source_geography: ListMeasuresResponse200DataItemSourcesItemSourceGeography
    observation_artifact: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        coverage = self.coverage.to_dict()

        dataset_id = self.dataset_id

        periods = self.periods

        source_geography = self.source_geography.to_dict()

        observation_artifact = self.observation_artifact

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "coverage": coverage,
                "datasetId": dataset_id,
                "periods": periods,
                "sourceGeography": source_geography,
            }
        )
        if observation_artifact is not UNSET:
            field_dict["observationArtifact"] = observation_artifact

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.list_measures_response_200_data_item_sources_item_coverage import (
            ListMeasuresResponse200DataItemSourcesItemCoverage,
        )
        from ..models.list_measures_response_200_data_item_sources_item_source_geography import (
            ListMeasuresResponse200DataItemSourcesItemSourceGeography,
        )

        d = dict(src_dict)
        coverage = ListMeasuresResponse200DataItemSourcesItemCoverage.from_dict(
            d.pop("coverage")
        )

        dataset_id = d.pop("datasetId")

        periods = cast(list[str], d.pop("periods"))

        source_geography = (
            ListMeasuresResponse200DataItemSourcesItemSourceGeography.from_dict(
                d.pop("sourceGeography")
            )
        )

        observation_artifact = d.pop("observationArtifact", UNSET)

        list_measures_response_200_data_item_sources_item = cls(
            coverage=coverage,
            dataset_id=dataset_id,
            periods=periods,
            source_geography=source_geography,
            observation_artifact=observation_artifact,
        )

        list_measures_response_200_data_item_sources_item.additional_properties = d
        return list_measures_response_200_data_item_sources_item

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
