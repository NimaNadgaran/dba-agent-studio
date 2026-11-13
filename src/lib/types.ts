import { z } from "zod";

export const dbmsNames = ["PostgreSQL", "MySQL", "SQLite", "SQL Server"] as const;
export const dbmsSchema = z.enum(dbmsNames);
export type DBMS = z.infer<typeof dbmsSchema>;
export const categories = ["Entities & attributes", "Relationships & cardinality", "Volume & growth", "Queries & reporting", "Transactions & concurrency", "Security & privacy", "Business rules"] as const;
export const providerSchema = z.object({
  provider: z.enum(["demo", "compatible", "ollama"]).default("demo"),
  model: z.string().max(120).default(""),
  baseUrl: z.string().max(300).default(""),
});
export type ProviderConfig = z.infer<typeof providerSchema>;
export const agentStageSchema = z.enum(["intake", "interview", "selection", "design", "revision", "repair"]);
export const agentConfigsSchema = z.partialRecord(agentStageSchema, providerSchema);
export const apiKeysSchema = z.record(z.string().max(300), z.string().max(1000)).refine(keys => Object.keys(keys).length <= 20, "Too many API keys.");
export type AgentConfigs = z.infer<typeof agentConfigsSchema>;
export type ApiKeys = Record<string, string>;
export const intakeSchema = z.object({
  title: z.string().min(3).max(100),
  summary: z.string().min(30),
  actors: z.array(z.string()).min(1),
  entities: z.array(z.string()).min(1),
  processes: z.array(z.string()).min(1),
  risks: z.array(z.string()),
});
export type Intake = z.infer<typeof intakeSchema>;
export const questionSchema = z.object({
  id: z.string().min(1).max(60),
  category: z.enum(categories),
  question: z.string().min(10),
  hint: z.string(),
});
export type Question = z.infer<typeof questionSchema>;
export const interviewSchema = z.object({
  ready: z.boolean(),
  rationale: z.string().min(10),
  summary: z.string(),
  questions: z.array(questionSchema).max(14),
});
export const choiceSchema = z.object({
  selected: dbmsSchema,
  rationale: z.string().min(30),
  comparison: z.array(z.object({
    dbms: dbmsSchema,
    score: z.number().int().min(1).max(10),
    strengths: z.string(),
    tradeoffs: z.string(),
    verdict: z.string(),
  })).length(4),
});
export type Choice = z.infer<typeof choiceSchema>;
const identifier = z.string().regex(/^[a-z][a-z0-9_]{0,47}$/);
export const scalarSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export type Scalar = z.infer<typeof scalarSchema>;
export const columnSchema = z.object({
  name: identifier,
  type: z.enum(["integer", "bigint", "string", "text", "decimal", "boolean", "date", "timestamp", "uuid", "json"]),
  length: z.number().int().min(1).max(4000).optional(),
  precision: z.number().int().min(1).max(38).optional(),
  scale: z.number().int().min(0).max(18).optional(),
  nullable: z.boolean(),
  description: z.string().min(1),
  default: scalarSchema.optional(),
});
export type Column = z.infer<typeof columnSchema>;
export const designSchema = z.object({
  name: z.string().min(3),
  overview: z.string().min(30),
  tables: z.array(z.object({
    name: identifier,
    purpose: z.string().min(10),
    columns: z.array(columnSchema).min(1).max(50),
    primaryKey: z.array(identifier).min(1),
    unique: z.array(z.array(identifier).min(1)),
    foreignKeys: z.array(z.object({
      columns: z.array(identifier).min(1),
      refTable: identifier,
      refColumns: z.array(identifier).min(1),
      onDelete: z.enum(["RESTRICT", "CASCADE", "SET NULL", "NO ACTION"]),
    })),
    checks: z.array(z.object({ name: identifier, expression: z.string().min(1).max(500) })),
    indexes: z.array(z.object({ name: identifier, columns: z.array(identifier).min(1), unique: z.boolean() })),
    functionalDependencies: z.array(z.string()).min(1),
    normalization: z.string().min(20),
    rows: z.array(z.record(z.string(), scalarSchema)).min(3).max(30),
  })).min(1).max(30),
  assumptions: z.array(z.string()),
  businessRules: z.array(z.string()),
  security: z.array(z.string()),
  denormalizations: z.array(z.string()),
});
export type Design = z.infer<typeof designSchema>;
export type Table = Design["tables"][number];
export type Stage = 1 | 2 | 3 | 4 | 5 | 6;
export type Artifact = { name: string; content: string; stage: Stage; updatedAt: string; version: number };
export type CallLog = {
  id: string; at: string; stage: string; provider: string; model: string; attempt: number;
  durationMs: number; status: "success" | "error"; input: string; output: string; error?: string; baseUrl?: string; resolvedModel?: string;
};
export type Validation = {
  engine: string; status: "passed" | "failed" | "structural"; attempts: number; durationMs: number;
  checks: { name: string; passed: boolean; detail: string }[]; error?: string;
};
export type Change = { version: number; at: string; request: string; summary: string; files: string[] };
export type InterviewRound = { questions: Question[]; answers: Record<string, string>; at: string; rationale?: string };
export type Session = {
  id: string; title: string; description: string; createdAt: string; updatedAt: string; version: number;
  stage: Stage; completedStages: Stage[]; mode: "demo" | "live"; config: ProviderConfig;
  agentConfigs?: AgentConfigs;
  intake?: Intake; interview: { rounds: InterviewRound[]; pending: Question[]; ready: boolean; summary: string; rationale: string };
  choice?: Choice; design?: Design; designVersion: number; approvedAt?: string;
  artifacts: Record<string, Artifact>; changes: Change[]; logs: CallLog[];
  validation?: Validation; validationHistory: Validation[];
};
export type SessionSummary = Pick<Session, "id" | "title" | "description" | "createdAt" | "updatedAt" | "stage" | "completedStages" | "mode" | "designVersion" | "approvedAt" | "version"> & { tables: number; artifacts: number; dbms?: DBMS };
export const stageNames = ["System intake", "Requirements interview", "DBMS selection", "Design documentation", "Review & refine", "SQL generation"];

export class AppError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
