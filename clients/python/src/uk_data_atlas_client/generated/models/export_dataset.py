from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.export_dataset_inputs_item import ExportDatasetInputsItem
    from ..models.export_dataset_licence import ExportDatasetLicence


T = TypeVar("T", bound="ExportDataset")


@_attrs_define
class ExportDataset:
    """
    Attributes:
        href (str):
        inputs (list[ExportDatasetInputsItem]):
        licence (ExportDatasetLicence):
        publisher (str):
        source_url (str):
    """

    href: str
    inputs: list[ExportDatasetInputsItem]
    licence: ExportDatasetLicence
    publisher: str
    source_url: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        href = self.href

        inputs = []
        for inputs_item_data in self.inputs:
            inputs_item = inputs_item_data.to_dict()
            inputs.append(inputs_item)

        licence = self.licence.to_dict()

        publisher = self.publisher

        source_url = self.source_url

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "href": href,
                "inputs": inputs,
                "licence": licence,
                "publisher": publisher,
                "sourceUrl": source_url,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.export_dataset_inputs_item import ExportDatasetInputsItem
        from ..models.export_dataset_licence import ExportDatasetLicence

        d = dict(src_dict)
        href = d.pop("href")

        inputs = []
        _inputs = d.pop("inputs")
        for inputs_item_data in _inputs:
            inputs_item = ExportDatasetInputsItem.from_dict(inputs_item_data)

            inputs.append(inputs_item)

        licence = ExportDatasetLicence.from_dict(d.pop("licence"))

        publisher = d.pop("publisher")

        source_url = d.pop("sourceUrl")

        export_dataset = cls(
            href=href,
            inputs=inputs,
            licence=licence,
            publisher=publisher,
            source_url=source_url,
        )

        export_dataset.additional_properties = d
        return export_dataset

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
