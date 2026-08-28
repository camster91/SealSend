import { z } from "zod";

const segments = [
  "club_association",
  "volunteer_nonprofit",
  "creative_community",
  "alumni_professional",
  "repeat_planner",
] as const;

const rateThreshold = z.number().min(0).max(1);
const cohortVersion = z.string().regex(/^[a-z0-9][a-z0-9-]{2,63}$/);
const thresholdsSchema = z.object({
  minimumCohortSize: z.number().int().min(5),
  requiredSegments: z.array(z.enum(segments)).length(5).refine(
    (values) => new Set(values).size === segments.length,
    "Every required segment must appear exactly once",
  ),
  minimumWorkflowCompletionRate: rateThreshold,
  minimumFeedbackRate: rateThreshold,
  minimumOutcomeResponseRate: rateThreshold,
  minimumSupportReviewRate: rateThreshold,
  minimumDefectReviewRate: rateThreshold,
  minimumRepeatUseRate: rateThreshold,
  minimumAverageFeedbackRating: z.number().min(1).max(5),
  maximumMedianHoursToFirstPublish: z.number().positive().max(720),
  maximumMedianOperatorSupportMinutes: z.number().min(0).max(600),
  maximumUnresolvedCriticalDefects: z.literal(0),
  minimumWillingToPayHosts: z.number().int().min(1).max(5),
}).strict();

const policySchema = z.discriminatedUnion("status", [
  z.object({
    schemaVersion: z.literal(1),
    cohortVersion,
    status: z.literal("pending"),
    approvedBy: z.null(),
    approvedAt: z.null(),
    thresholds: z.null(),
  }).strict(),
  z.object({
    schemaVersion: z.literal(1),
    cohortVersion,
    status: z.literal("approved"),
    approvedBy: z.string().trim().min(2).max(100),
    approvedAt: z.string().datetime(),
    thresholds: thresholdsSchema,
  }).strict(),
]);

interface RateMetric {
  numerator: number;
  denominator: number;
  rate: number | null;
}

interface BetaAcceptanceMetrics {
  cohortSize: number;
  segmentsRepresented: string[];
  workflowCompletion: RateMetric;
  feedback: RateMetric;
  repeatUse: RateMetric;
  medianHoursToFirstPublish: number | null;
  averageFeedbackRating: number | null;
  statedWillingnessToPay: {
    annualPro: number;
    perEvent: number;
    responses: number;
    denominator: number;
  };
  supportReviewCoverage: RateMetric;
  medianOperatorRecordedSupportMinutes: number | null;
  defectReviewCoverage: RateMetric;
  unresolvedCriticalDefects: number | null;
}

type CheckStatus = "pass" | "fail" | "missing";
interface AcceptanceCheck {
  id: string;
  status: CheckStatus;
  actual: number | string[] | null;
  threshold: number | string[];
}

function minimumCheck(id: string, actual: number | null, threshold: number): AcceptanceCheck {
  return { id, actual, threshold, status: actual === null ? "missing" : actual >= threshold ? "pass" : "fail" };
}

function maximumCheck(id: string, actual: number | null, threshold: number): AcceptanceCheck {
  return { id, actual, threshold, status: actual === null ? "missing" : actual <= threshold ? "pass" : "fail" };
}

export function evaluateBetaAcceptance(input: {
  policy: unknown;
  metrics: BetaAcceptanceMetrics;
  cohortStartedAt: string | null;
}) {
  const parsed = policySchema.safeParse(input.policy);
  if (!parsed.success) {
    return {
      decision: "INVALID_POLICY" as const,
      passed: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      checks: [] as AcceptanceCheck[],
    };
  }
  if (parsed.data.status === "pending") {
    return {
      decision: "POLICY_NOT_APPROVED" as const,
      passed: false,
      errors: [] as string[],
      checks: [] as AcceptanceCheck[],
    };
  }

  const approvedAt = new Date(parsed.data.approvedAt).getTime();
  if (input.cohortStartedAt && approvedAt >= new Date(input.cohortStartedAt).getTime()) {
    return {
      decision: "INVALID_POLICY" as const,
      passed: false,
      errors: ["Threshold approval must occur before the first host consent."],
      checks: [] as AcceptanceCheck[],
    };
  }

  const thresholds = parsed.data.thresholds;
  const represented = new Set(input.metrics.segmentsRepresented);
  const segmentStatus = thresholds.requiredSegments.every((segment) => represented.has(segment))
    ? "pass" as const
    : "fail" as const;
  const outcomeRate = input.metrics.statedWillingnessToPay.denominator === 0
    ? null
    : input.metrics.statedWillingnessToPay.responses / input.metrics.statedWillingnessToPay.denominator;
  const willingToPayHosts = input.metrics.statedWillingnessToPay.annualPro
    + input.metrics.statedWillingnessToPay.perEvent;
  const checks: AcceptanceCheck[] = [
    minimumCheck("cohort_size", input.metrics.cohortSize, thresholds.minimumCohortSize),
    {
      id: "required_segments",
      actual: input.metrics.segmentsRepresented,
      threshold: thresholds.requiredSegments,
      status: segmentStatus,
    },
    minimumCheck("workflow_completion", input.metrics.workflowCompletion.rate, thresholds.minimumWorkflowCompletionRate),
    minimumCheck("feedback_coverage", input.metrics.feedback.rate, thresholds.minimumFeedbackRate),
    minimumCheck("outcome_response_coverage", outcomeRate, thresholds.minimumOutcomeResponseRate),
    minimumCheck("support_review_coverage", input.metrics.supportReviewCoverage.rate, thresholds.minimumSupportReviewRate),
    minimumCheck("defect_review_coverage", input.metrics.defectReviewCoverage.rate, thresholds.minimumDefectReviewRate),
    minimumCheck("repeat_use", input.metrics.repeatUse.rate, thresholds.minimumRepeatUseRate),
    minimumCheck("average_feedback_rating", input.metrics.averageFeedbackRating, thresholds.minimumAverageFeedbackRating),
    maximumCheck("hours_to_first_publish", input.metrics.medianHoursToFirstPublish, thresholds.maximumMedianHoursToFirstPublish),
    maximumCheck("operator_support_minutes", input.metrics.medianOperatorRecordedSupportMinutes, thresholds.maximumMedianOperatorSupportMinutes),
    maximumCheck("unresolved_critical_defects", input.metrics.unresolvedCriticalDefects, thresholds.maximumUnresolvedCriticalDefects),
    minimumCheck("willing_to_pay_hosts", willingToPayHosts, thresholds.minimumWillingToPayHosts),
  ];
  const passed = checks.every((check) => check.status === "pass");
  return {
    decision: passed ? "BETA_ACCEPTANCE_PASS" as const : "BETA_ACCEPTANCE_FAIL" as const,
    passed,
    errors: [] as string[],
    checks,
  };
}
