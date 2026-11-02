from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.list_measures_response_200_data_item_resolved_from_dimensions import (
        ListMeasuresResponse200DataItemResolvedFromDimensions,
    )


T = TypeVar("T", bound="ListMeasuresResponse200DataItemResolvedFrom")


@_attrs_define
class ListMeasuresResponse200DataItemResolvedFrom:
    """
    Attributes:
        deprecated (bool):
        dimensions (ListMeasuresResponse200DataItemResolvedFromDimensions):
        id (str):
        measure (str):
        dataset_id (str | Unset):
    """

    deprecated: bool
    dimensions: ListMeasuresResponse200DataItemResolvedFromDimensions
    id: str
    measure: str
    dataset_id: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        deprecated = self.deprecated

        dimensions = self.dimensions.to_dict()

        id = self.id

        measure = self.measure

        dataset_id = self.dataset_id

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "deprecated": deprecated,
                "dimensions": dimensions,
                "id": id,
                "measure": measure,
            }
        )
        if dataset_id is not UNSET:
            field_dict["datasetId"] = dataset_id

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_measures_response_200_data_item_resolved_from_dimensions import (
            ListMeasuresResponse200DataItemResolvedFromDimensions,  # noqa: PLC0415
        )

        d = dict(src_dict)
        deprecated = d.pop("deprecated")

        dimensions = ListMeasuresResponse200DataItemResolvedFromDimensions.from_dict(
            d.pop("dimensions")
        )

        id = d.pop("id")

        measure = d.pop("measure")

        dataset_id = d.pop("datasetId", UNSET)

        list_measures_response_200_data_item_resolved_from = cls(
            deprecated=deprecated,
            dimensions=dimensions,
            id=id,
            measure=measure,
            dataset_id=dataset_id,
        )

        list_measures_response_200_data_item_resolved_from.additional_properties = d
        return list_measures_response_200_data_item_resolved_from

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
