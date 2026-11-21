// "sample" is mock data shown with a visible label. "live" comes from the Results API.
export type DataSource = "sample" | "live";

export interface Sourced<T> {
  source: DataSource;
  data: T;
}

export type {
  AiQualityResponse,
  EngineStats,
  GoldenRun,
  LiveDraft,
  Coverage,
  FlakyTest,
  Healing,
  HealedTest,
  MetricsResponse,
  ReadinessReason,
  SlowTest,
  SuiteKind,
  TrendPoint,
  Verdict,
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
