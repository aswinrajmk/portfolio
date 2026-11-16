// "sample" is mock data shown with a visible label. "live" comes from the Results API.
export type DataSource = "sample" | "live";

export interface Sourced<T> {
  source: DataSource;
  data: T;
}

export type {
  Healing,
  Requirement,
  RequirementsResponse,
  RequirementState,
  RequirementTest,
  RunCounts,
  RunDetail,
  RunStatus,
  RunSummary,
  RunTrigger,
  TestResult,
  TestStatus,
  TestStep,
} from "../../shared/results";
