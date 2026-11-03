from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.bulk_export_provenance_datasets_item import (
        BulkExportProvenanceDatasetsItem,
    )


T = TypeVar("T", bound="BulkExportProvenance")


@_attrs_define
class BulkExportProvenance:
    """
    Attributes:
        datasets (list[BulkExportProvenanceDatasetsItem]): Each id is described in the manifest's `datasets`.
        measure (str):
    """

    datasets: list[BulkExportProvenanceDatasetsItem]
    measure: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        datasets = []
        for datasets_item_data in self.datasets:
            datasets_item = datasets_item_data.to_dict()
            datasets.append(datasets_item)

        measure = self.measure

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "datasets": datasets,
                "measure": measure,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.bulk_export_provenance_datasets_item import (
            BulkExportProvenanceDatasetsItem,
        )

        d = dict(src_dict)
        datasets = []
        _datasets = d.pop("datasets")
        for datasets_item_data in _datasets:
            datasets_item = BulkExportProvenanceDatasetsItem.from_dict(
                datasets_item_data
            )

            datasets.append(datasets_item)

        measure = d.pop("measure")

        bulk_export_provenance = cls(
            datasets=datasets,
            measure=measure,
        )

        bulk_export_provenance.additional_properties = d
        return bulk_export_provenance

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
