"use client";
import PopulationDensityChart from "./density/PopulationDensityChart";
import AgeDistribution from "./age/AgeDistribution";
import Gender from "./gender/Gender";
import EthnicityChart from "./ethnicity/EthnicityChart";

const dataset = (props: any) => props.availableDatasets?.[props.year];
export function PopulationDensityRegistryChart(props: any) { return <PopulationDensityChart dataset={dataset(props)} aggregatedData={props.aggregatedData} boundaryData={props.boundaryData} selectedArea={props.selectedArea} codeMapper={props.codeMapper} activeViz={props.activeViz} setActiveViz={props.setActiveViz} />; }
export function PopulationAgeRegistryChart(props: any) { return <AgeDistribution dataset={dataset(props)} aggregatedData={props.aggregatedData} selectedArea={props.selectedArea} codeMapper={props.codeMapper} activeViz={props.activeViz} setActiveViz={props.setActiveViz} />; }
export function PopulationGenderRegistryChart(props: any) { return <Gender dataset={dataset(props)} aggregatedData={props.aggregatedData} selectedArea={props.selectedArea} codeMapper={props.codeMapper} activeViz={props.activeViz} setActiveViz={props.setActiveViz} />; }
export function EthnicityRegistryChart(props: any) { return <EthnicityChart dataset={dataset(props)} aggregatedData={props.aggregatedData} selectedArea={props.selectedArea} codeMapper={props.codeMapper} activeViz={props.activeViz} setActiveViz={props.setActiveViz} />; }
