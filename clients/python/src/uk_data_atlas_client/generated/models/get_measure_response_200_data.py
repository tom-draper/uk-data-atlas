from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, Self, TypeVar, cast

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.get_measure_response_200_data_value_kind import (
    GetMeasureResponse200DataValueKind,
)
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.get_measure_response_200_data_aggregation import (
        GetMeasureResponse200DataAggregation,
    )
    from ..models.get_measure_response_200_data_availability import (
        GetMeasureResponse200DataAvailability,
    )
    from ..models.get_measure_response_200_data_derived_from import (
        GetMeasureResponse200DataDerivedFrom,
    )
    from ..models.get_measure_response_200_data_elsewhere_item import (
        GetMeasureResponse200DataElsewhereItem,
    )
    from ..models.get_measure_response_200_data_links import (
        GetMeasureResponse200DataLinks,
    )
    from ..models.get_measure_response_200_data_sources_item import (
        GetMeasureResponse200DataSourcesItem,
    )
    from ..models.get_measure_response_200_data_uncertainty import (
        GetMeasureResponse200DataUncertainty,
    )
    from ..models.get_measure_response_200_data_unit_definition import (
        GetMeasureResponse200DataUnitDefinition,
    )


T = TypeVar("T", bound="GetMeasureResponse200Data")


@_attrs_define
class GetMeasureResponse200Data:
    """
    Attributes:
        aggregation (GetMeasureResponse200DataAggregation):
        availability (GetMeasureResponse200DataAvailability):
        id (str):
        label (str):
        links (GetMeasureResponse200DataLinks):
        sources (list[GetMeasureResponse200DataSourcesItem]):
        unit (str):
        value_kind (GetMeasureResponse200DataValueKind):
        aliases (list[str] | Unset):
        concept (str | Unset):
        derived_from (GetMeasureResponse200DataDerivedFrom | Unset):
        elsewhere (list[GetMeasureResponse200DataElsewhereItem] | Unset):
        notes (list[str] | Unset):
        uncertainty (GetMeasureResponse200DataUncertainty | Unset):
        unit_definition (GetMeasureResponse200DataUnitDefinition | Unset):
    """

    aggregation: GetMeasureResponse200DataAggregation
    availability: GetMeasureResponse200DataAvailability
    id: str
    label: str
    links: GetMeasureResponse200DataLinks
    sources: list[GetMeasureResponse200DataSourcesItem]
    unit: str
    value_kind: GetMeasureResponse200DataValueKind
    aliases: list[str] | Unset = UNSET
    concept: str | Unset = UNSET
    derived_from: GetMeasureResponse200DataDerivedFrom | Unset = UNSET
    elsewhere: list[GetMeasureResponse200DataElsewhereItem] | Unset = UNSET
    notes: list[str] | Unset = UNSET
    uncertainty: GetMeasureResponse200DataUncertainty | Unset = UNSET
    unit_definition: GetMeasureResponse200DataUnitDefinition | Unset = UNSET
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
        from ..models.get_measure_response_200_data_aggregation import (
            GetMeasureResponse200DataAggregation,
        )
        from ..models.get_measure_response_200_data_availability import (
            GetMeasureResponse200DataAvailability,
        )
        from ..models.get_measure_response_200_data_derived_from import (
            GetMeasureResponse200DataDerivedFrom,
        )
        from ..models.get_measure_response_200_data_elsewhere_item import (
            GetMeasureResponse200DataElsewhereItem,
        )
        from ..models.get_measure_response_200_data_links import (
            GetMeasureResponse200DataLinks,
        )
        from ..models.get_measure_response_200_data_sources_item import (
            GetMeasureResponse200DataSourcesItem,
        )
        from ..models.get_measure_response_200_data_uncertainty import (
            GetMeasureResponse200DataUncertainty,
        )
        from ..models.get_measure_response_200_data_unit_definition import (
            GetMeasureResponse200DataUnitDefinition,
        )

        d = dict(src_dict)
        aggregation = GetMeasureResponse200DataAggregation.from_dict(
            d.pop("aggregation")
        )

        availability = GetMeasureResponse200DataAvailability.from_dict(
            d.pop("availability")
        )

        id = d.pop("id")

        label = d.pop("label")

        links = GetMeasureResponse200DataLinks.from_dict(d.pop("links"))

        sources = []
        _sources = d.pop("sources")
        for sources_item_data in _sources:
            sources_item = GetMeasureResponse200DataSourcesItem.from_dict(
                sources_item_data
            )

            sources.append(sources_item)

        unit = d.pop("unit")

        value_kind = GetMeasureResponse200DataValueKind(d.pop("valueKind"))

        aliases = cast(list[str], d.pop("aliases", UNSET))

        concept = d.pop("concept", UNSET)

        _derived_from = d.pop("derivedFrom", UNSET)
        derived_from: GetMeasureResponse200DataDerivedFrom | Unset
        if isinstance(_derived_from, Unset):
            derived_from = UNSET
        else:
            derived_from = GetMeasureResponse200DataDerivedFrom.from_dict(_derived_from)

        _elsewhere = d.pop("elsewhere", UNSET)
        elsewhere: list[GetMeasureResponse200DataElsewhereItem] | Unset = UNSET
        if _elsewhere is not UNSET:
            elsewhere = []
            for elsewhere_item_data in _elsewhere:
                elsewhere_item = GetMeasureResponse200DataElsewhereItem.from_dict(
                    elsewhere_item_data
                )

                elsewhere.append(elsewhere_item)

        notes = cast(list[str], d.pop("notes", UNSET))

        _uncertainty = d.pop("uncertainty", UNSET)
        uncertainty: GetMeasureResponse200DataUncertainty | Unset
        if isinstance(_uncertainty, Unset):
            uncertainty = UNSET
        else:
            uncertainty = GetMeasureResponse200DataUncertainty.from_dict(_uncertainty)

        _unit_definition = d.pop("unitDefinition", UNSET)
        unit_definition: GetMeasureResponse200DataUnitDefinition | Unset
        if isinstance(_unit_definition, Unset):
            unit_definition = UNSET
        else:
            unit_definition = GetMeasureResponse200DataUnitDefinition.from_dict(
                _unit_definition
            )

        get_measure_response_200_data = cls(
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

        get_measure_response_200_data.additional_properties = d
        return get_measure_response_200_data

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
