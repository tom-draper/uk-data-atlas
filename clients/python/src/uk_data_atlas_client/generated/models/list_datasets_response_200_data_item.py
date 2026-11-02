from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.list_datasets_response_200_data_item_compiled import (
        ListDatasetsResponse200DataItemCompiled,
    )
    from ..models.list_datasets_response_200_data_item_inputs_item import (
        ListDatasetsResponse200DataItemInputsItem,
    )
    from ..models.list_datasets_response_200_data_item_licence import (
        ListDatasetsResponse200DataItemLicence,
    )
    from ..models.list_datasets_response_200_data_item_summary import (
        ListDatasetsResponse200DataItemSummary,
    )


T = TypeVar("T", bound="ListDatasetsResponse200DataItem")


@_attrs_define
class ListDatasetsResponse200DataItem:
    """
    Attributes:
        compiled (ListDatasetsResponse200DataItemCompiled):
        id (str):
        inputs (list[ListDatasetsResponse200DataItemInputsItem]):
        label (str):
        licence (ListDatasetsResponse200DataItemLicence):
        publisher (str):
        source_url (str):
        summary (ListDatasetsResponse200DataItemSummary):
        temporal_coverage (str):
        description (str | Unset):
    """

    compiled: ListDatasetsResponse200DataItemCompiled
    id: str
    inputs: list[ListDatasetsResponse200DataItemInputsItem]
    label: str
    licence: ListDatasetsResponse200DataItemLicence
    publisher: str
    source_url: str
    summary: ListDatasetsResponse200DataItemSummary
    temporal_coverage: str
    description: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        compiled = self.compiled.to_dict()

        id = self.id

        inputs = []
        for inputs_item_data in self.inputs:
            inputs_item = inputs_item_data.to_dict()
            inputs.append(inputs_item)

        label = self.label

        licence = self.licence.to_dict()

        publisher = self.publisher

        source_url = self.source_url

        summary = self.summary.to_dict()

        temporal_coverage = self.temporal_coverage

        description = self.description

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "compiled": compiled,
                "id": id,
                "inputs": inputs,
                "label": label,
                "licence": licence,
                "publisher": publisher,
                "sourceUrl": source_url,
                "summary": summary,
                "temporalCoverage": temporal_coverage,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.list_datasets_response_200_data_item_compiled import (
            ListDatasetsResponse200DataItemCompiled,
        )
        from ..models.list_datasets_response_200_data_item_inputs_item import (
            ListDatasetsResponse200DataItemInputsItem,
        )
        from ..models.list_datasets_response_200_data_item_licence import (
            ListDatasetsResponse200DataItemLicence,
        )
        from ..models.list_datasets_response_200_data_item_summary import (
            ListDatasetsResponse200DataItemSummary,
        )

        d = dict(src_dict)
        compiled = ListDatasetsResponse200DataItemCompiled.from_dict(d.pop("compiled"))

        id = d.pop("id")

        inputs = []
        _inputs = d.pop("inputs")
        for inputs_item_data in _inputs:
            inputs_item = ListDatasetsResponse200DataItemInputsItem.from_dict(
                inputs_item_data
            )

            inputs.append(inputs_item)

        label = d.pop("label")

        licence = ListDatasetsResponse200DataItemLicence.from_dict(d.pop("licence"))

        publisher = d.pop("publisher")

        source_url = d.pop("sourceUrl")

        summary = ListDatasetsResponse200DataItemSummary.from_dict(d.pop("summary"))

        temporal_coverage = d.pop("temporalCoverage")

        description = d.pop("description", UNSET)

        list_datasets_response_200_data_item = cls(
            compiled=compiled,
            id=id,
            inputs=inputs,
            label=label,
            licence=licence,
            publisher=publisher,
            source_url=source_url,
            summary=summary,
            temporal_coverage=temporal_coverage,
            description=description,
        )

        list_datasets_response_200_data_item.additional_properties = d
        return list_datasets_response_200_data_item

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
