from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.list_measures_response_200_data_item_value_kind import (
    ListMeasuresResponse200DataItemValueKind,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.list_measures_response_200_data_item_aggregation import (
        ListMeasuresResponse200DataItemAggregation,
    )
    from ..models.list_measures_response_200_data_item_availability import (
        ListMeasuresResponse200DataItemAvailability,
    )
    from ..models.list_measures_response_200_data_item_derived_from import (
        ListMeasuresResponse200DataItemDerivedFrom,
    )
    from ..models.list_measures_response_200_data_item_elsewhere_item import (
        ListMeasuresResponse200DataItemElsewhereItem,
    )
    from ..models.list_measures_response_200_data_item_links import (
        ListMeasuresResponse200DataItemLinks,
    )
    from ..models.list_measures_response_200_data_item_sources_item import (
        ListMeasuresResponse200DataItemSourcesItem,
    )
    from ..models.list_measures_response_200_data_item_uncertainty import (
        ListMeasuresResponse200DataItemUncertainty,
    )
    from ..models.list_measures_response_200_data_item_unit_definition import (
        ListMeasuresResponse200DataItemUnitDefinition,
    )


T = TypeVar("T", bound="ListMeasuresResponse200DataItem")


@_attrs_define
class ListMeasuresResponse200DataItem:
    """
    Attributes:
        aggregation (ListMeasuresResponse200DataItemAggregation):
        availability (ListMeasuresResponse200DataItemAvailability):
        id (str):
        label (str):
        links (ListMeasuresResponse200DataItemLinks):
        sources (list[ListMeasuresResponse200DataItemSourcesItem]):
        unit (str):
        value_kind (ListMeasuresResponse200DataItemValueKind):
        aliases (list[str] | Unset):
        concept (str | Unset):
        derived_from (ListMeasuresResponse200DataItemDerivedFrom | Unset):
        elsewhere (list[ListMeasuresResponse200DataItemElsewhereItem] | Unset):
        notes (list[str] | Unset):
        uncertainty (ListMeasuresResponse200DataItemUncertainty | Unset):
        unit_definition (ListMeasuresResponse200DataItemUnitDefinition | Unset):
    """

    aggregation: ListMeasuresResponse200DataItemAggregation
    availability: ListMeasuresResponse200DataItemAvailability
    id: str
    label: str
    links: ListMeasuresResponse200DataItemLinks
    sources: list[ListMeasuresResponse200DataItemSourcesItem]
    unit: str
    value_kind: ListMeasuresResponse200DataItemValueKind
    aliases: list[str] | Unset = UNSET
    concept: str | Unset = UNSET
    derived_from: ListMeasuresResponse200DataItemDerivedFrom | Unset = UNSET
    elsewhere: list[ListMeasuresResponse200DataItemElsewhereItem] | Unset = UNSET
    notes: list[str] | Unset = UNSET
    uncertainty: ListMeasuresResponse200DataItemUncertainty | Unset = UNSET
    unit_definition: ListMeasuresResponse200DataItemUnitDefinition | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        aggregation = self.aggregation.to_dict()

        availability = self.availability.to_dict()

        id = self.id

        label = self.label

        links = self.links.to_dict()

        sources = []
        for sources_item_data in self.sources:
            sources_item = sources_item_data.to_dict()
            sources.append(sources_item)

        unit = self.unit

        value_kind = self.value_kind.value

        aliases: list[str] | Unset = UNSET
        if not isinstance(self.aliases, Unset):
            aliases = self.aliases

        concept = self.concept

        derived_from: dict[str, Any] | Unset = UNSET
        if not isinstance(self.derived_from, Unset):
            derived_from = self.derived_from.to_dict()

        elsewhere: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.elsewhere, Unset):
            elsewhere = []
            for elsewhere_item_data in self.elsewhere:
                elsewhere_item = elsewhere_item_data.to_dict()
                elsewhere.append(elsewhere_item)

        notes: list[str] | Unset = UNSET
        if not isinstance(self.notes, Unset):
            notes = self.notes

        uncertainty: dict[str, Any] | Unset = UNSET
        if not isinstance(self.uncertainty, Unset):
            uncertainty = self.uncertainty.to_dict()

        unit_definition: dict[str, Any] | Unset = UNSET
        if not isinstance(self.unit_definition, Unset):
            unit_definition = self.unit_definition.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "aggregation": aggregation,
                "availability": availability,
                "id": id,
                "label": label,
                "links": links,
                "sources": sources,
                "unit": unit,
                "valueKind": value_kind,
            }
        )
        if aliases is not UNSET:
            field_dict["aliases"] = aliases
        if concept is not UNSET:
            field_dict["concept"] = concept
        if derived_from is not UNSET:
            field_dict["derivedFrom"] = derived_from
        if elsewhere is not UNSET:
            field_dict["elsewhere"] = elsewhere
        if notes is not UNSET:
            field_dict["notes"] = notes
        if uncertainty is not UNSET:
            field_dict["uncertainty"] = uncertainty
        if unit_definition is not UNSET:
            field_dict["unitDefinition"] = unit_definition

        return field_dict

    @classmethod
    def from_dict(cls, src_dict: Mapping[str, Any]) -> Self:
        from ..models.list_measures_response_200_data_item_aggregation import (
            ListMeasuresResponse200DataItemAggregation,
        )
        from ..models.list_measures_response_200_data_item_availability import (
            ListMeasuresResponse200DataItemAvailability,
        )
        from ..models.list_measures_response_200_data_item_derived_from import (
            ListMeasuresResponse200DataItemDerivedFrom,
        )
        from ..models.list_measures_response_200_data_item_elsewhere_item import (
            ListMeasuresResponse200DataItemElsewhereItem,
        )
        from ..models.list_measures_response_200_data_item_links import (
            ListMeasuresResponse200DataItemLinks,
        )
        from ..models.list_measures_response_200_data_item_sources_item import (
            ListMeasuresResponse200DataItemSourcesItem,
        )
        from ..models.list_measures_response_200_data_item_uncertainty import (
            ListMeasuresResponse200DataItemUncertainty,
        )
        from ..models.list_measures_response_200_data_item_unit_definition import (
            ListMeasuresResponse200DataItemUnitDefinition,
        )

        d = dict(src_dict)
        aggregation = ListMeasuresResponse200DataItemAggregation.from_dict(
            d.pop("aggregation")
        )

        availability = ListMeasuresResponse200DataItemAvailability.from_dict(
            d.pop("availability")
        )

        id = d.pop("id")

        label = d.pop("label")

        links = ListMeasuresResponse200DataItemLinks.from_dict(d.pop("links"))

        sources = []
        _sources = d.pop("sources")
        for sources_item_data in _sources:
            sources_item = ListMeasuresResponse200DataItemSourcesItem.from_dict(
                sources_item_data
            )

            sources.append(sources_item)

        unit = d.pop("unit")

        value_kind = ListMeasuresResponse200DataItemValueKind(d.pop("valueKind"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        concept = d.pop("concept", UNSET)

        _derived_from = d.pop("derivedFrom", UNSET)
        derived_from: ListMeasuresResponse200DataItemDerivedFrom | Unset
        if isinstance(_derived_from, Unset):
            derived_from = UNSET
        else:
            derived_from = ListMeasuresResponse200DataItemDerivedFrom.from_dict(
                _derived_from
            )

        _elsewhere = d.pop("elsewhere", UNSET)
        elsewhere: list[ListMeasuresResponse200DataItemElsewhereItem] | Unset = UNSET
        if _elsewhere is not UNSET:
            elsewhere = []
            for elsewhere_item_data in _elsewhere:
                elsewhere_item = ListMeasuresResponse200DataItemElsewhereItem.from_dict(
                    elsewhere_item_data
                )

                elsewhere.append(elsewhere_item)

        notes = cast(list[str], d.pop("notes", UNSET))

        _uncertainty = d.pop("uncertainty", UNSET)
        uncertainty: ListMeasuresResponse200DataItemUncertainty | Unset
        if isinstance(_uncertainty, Unset):
            uncertainty = UNSET
        else:
            uncertainty = ListMeasuresResponse200DataItemUncertainty.from_dict(
                _uncertainty
            )

        _unit_definition = d.pop("unitDefinition", UNSET)
        unit_definition: ListMeasuresResponse200DataItemUnitDefinition | Unset
        if isinstance(_unit_definition, Unset):
            unit_definition = UNSET
        else:
            unit_definition = ListMeasuresResponse200DataItemUnitDefinition.from_dict(
                _unit_definition
            )

        list_measures_response_200_data_item = cls(
            aggregation=aggregation,
            availability=availability,
            id=id,
            label=label,
            links=links,
            sources=sources,
            unit=unit,
            value_kind=value_kind,
            aliases=aliases,
            concept=concept,
            derived_from=derived_from,
            elsewhere=elsewhere,
            notes=notes,
            uncertainty=uncertainty,
            unit_definition=unit_definition,
        )

        list_measures_response_200_data_item.additional_properties = d
        return list_measures_response_200_data_item

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
