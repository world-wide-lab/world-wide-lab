// Schemas to power Data Validation for the Data Models

import {
  type InferType,
  ValidationError,
  boolean,
  date,
  number,
  object,
  string,
} from "yup";

const fullStudySchema = object({
  studyId: string()
    .matches(/^[a-zA-Z0-9-_]+$/)
    .required(),
  createdAt: date(),
  updatedAt: date(),
  privateInfo: object().optional(),
  publicInfo: object().optional(),
  deletionProtection: boolean(),
}).noUnknown();
const studySchema = fullStudySchema.omit([
  "deletionProtection",
  "createdAt",
  "updatedAt",
]);

const fullParticipantSchema = object({
  participantId: string().uuid().required(),
  createdAt: date(),
  updatedAt: date(),
  privateInfo: object().optional(),
  publicInfo: object().optional(),
}).noUnknown();
const participantSchema = fullParticipantSchema.omit([
  "participantId",
  "createdAt",
  "updatedAt",
]);

const fullSessionSchema = object({
  sessionId: string().uuid().required(),
  studyId: string().required(),
  participantId: string().uuid(),
  createdAt: date(),
  updatedAt: date(),
  privateInfo: object().optional(),
  publicInfo: object().optional(),
  finished: boolean(),
  metadata: object().optional(),
}).noUnknown();
const sessionSchema = fullSessionSchema.omit([
  "sessionId",
  "createdAt",
  "updatedAt",
  "finished",
]);
const sessionCreationRequestSchema = sessionSchema.omit(["metadata"]).shape({
  clientMetadata: object(),
});

const fullResponseSchema = object({
  responseId: number().integer().required(),
  sessionId: string().uuid().required(),
  createdAt: date(),
  updatedAt: date(),
  name: string(),
  payload: object().optional(),
  drawId: string().uuid().optional(),
}).noUnknown();
const responseSchema = fullResponseSchema.omit([
  "responseId",
  "createdAt",
  "updatedAt",
]);
// completesDraw is not stored on the response itself
const responseCreationRequestSchema = responseSchema.shape({
  completesDraw: boolean().optional(),
});

// Leaderboard Schema
const fullLeaderboardSchema = object({
  leaderboardId: string()
    .matches(/^[a-zA-Z0-9-_]+$/)
    .required(),
  createdAt: date(),
  updatedAt: date(),
  studyId: string().optional(),
  privateInfo: object().optional(),
}).noUnknown();
const leaderboardSchema = fullLeaderboardSchema.omit([
  "createdAt",
  "updatedAt",
]);

// Leaderboard Score Schema
const fullLeaderboardScoreSchema = object({
  leaderboardScoreId: number().integer().required(),
  createdAt: date(),
  updatedAt: date(),
  leaderboardId: string()
    .matches(/^[a-zA-Z0-9-_]+$/)
    .required(),
  sessionId: string().uuid().required(),
  score: number().required(),
  publicIndividualName: string().optional(),
  publicGroupName: string().optional(),
}).noUnknown();
const leaderboardScoreSchema = fullLeaderboardScoreSchema.omit([
  "leaderboardScoreId",
  "createdAt",
  "updatedAt",
]);

// Item Pool Schema
const fullItemPoolSchema = object({
  poolId: string()
    .matches(/^[a-zA-Z0-9-_]+$/)
    .required(),
  createdAt: date(),
  updatedAt: date(),
  studyId: string().optional(),
  moderation: string().oneOf(["reviewed", "unreviewed", "closed"]).optional(),
  publicInfo: object().optional(),
  privateInfo: object().optional(),
}).noUnknown();
const itemPoolSchema = fullItemPoolSchema.omit(["createdAt", "updatedAt"]);

// Item Schema
const fullItemSchema = object({
  itemId: string().uuid().required(),
  createdAt: date(),
  updatedAt: date(),
  poolId: string()
    .matches(/^[a-zA-Z0-9-_]+$/)
    .required(),
  publicPayload: object().required(),
  status: string()
    .oneOf(["pending", "approved", "rejected", "retired", "withdrawn"])
    .optional(),
  sourceSessionId: string().uuid().nullable().optional(),
  sourceResponseId: number().integer().nullable().optional(),
  parentItemId: string().uuid().nullable().optional(),
  generation: number().integer().min(0).optional(),
  timesDrawn: number().integer().min(0).optional(),
  timesCompleted: number().integer().min(0).optional(),
  privateInfo: object().optional(),
}).noUnknown();
// What a participant may send when contributing an item
const itemContributionSchema = object({
  publicPayload: object().required(),
  sessionId: string().uuid().optional(),
  responseId: number().integer().optional(),
  parentItemId: string().uuid().optional(),
  privateInfo: object().optional(),
}).noUnknown();

// Item Draw Schema
const fullItemDrawSchema = object({
  drawId: string().uuid().required(),
  createdAt: date(),
  updatedAt: date(),
  itemId: string().uuid().required(),
  sessionId: string().uuid().required(),
  status: string().oneOf(["served", "completed"]).optional(),
}).noUnknown();

// Query parameters of the draw endpoint
const drawQuerySchema = object({
  sessionId: string().uuid().required(),
  count: number().integer().min(1).max(100).optional().default(1),
  policy: string()
    .oneOf(["random", "least-drawn", "newest", "oldest"])
    .optional()
    .default("random"),
  excludeOwn: boolean().optional().default(true),
  excludeSeen: boolean().optional().default(true),
  maxDrawsPerItem: number().integer().min(1).optional(),
  maxCompletionsPerItem: number().integer().min(1).optional(),
  maxChildrenPerItem: number().integer().min(1).optional(),
  minGeneration: number().integer().min(0).optional(),
  maxGeneration: number().integer().min(0).optional(),
}).noUnknown();

// Query parameters of the read-only gallery endpoint
const itemListQuerySchema = object({
  limit: number().integer().min(1).max(1000).optional().default(100),
  sort: string().oneOf(["newest", "oldest", "random"]).optional(),
  cacheFor: number().integer().optional(),
}).noUnknown();

export {
  studySchema,
  participantSchema,
  sessionSchema,
  sessionCreationRequestSchema,
  responseSchema,
  responseCreationRequestSchema,
  leaderboardSchema,
  leaderboardScoreSchema,
  fullStudySchema,
  fullParticipantSchema,
  fullSessionSchema,
  fullResponseSchema,
  fullLeaderboardSchema,
  fullLeaderboardScoreSchema,
  itemPoolSchema,
  fullItemPoolSchema,
  itemContributionSchema,
  fullItemSchema,
  fullItemDrawSchema,
  drawQuerySchema,
  itemListQuerySchema,
  ValidationError,
};

type CreateStudyParams = InferType<typeof studySchema>;
type CreateParticipantParams = InferType<typeof participantSchema>;
type CreateSessionParams = InferType<typeof sessionSchema>;
type CreateResponseParams = InferType<typeof responseSchema>;
type CreateResponseRequestParams = InferType<
  typeof responseCreationRequestSchema
>;
type StudyParams = InferType<typeof fullStudySchema>;
type ParticipantParams = InferType<typeof fullParticipantSchema>;
type SessionParams = InferType<typeof fullSessionSchema>;
type ResponseParams = InferType<typeof fullResponseSchema>;
type CreateLeaderboardParams = InferType<typeof leaderboardSchema>;
type CreateLeaderboardScoreParams = InferType<typeof leaderboardScoreSchema>;
type LeaderboardParams = InferType<typeof fullLeaderboardSchema>;
type LeaderboardScoreParams = InferType<typeof fullLeaderboardScoreSchema>;
type CreateItemPoolParams = InferType<typeof itemPoolSchema>;
type ItemPoolParams = InferType<typeof fullItemPoolSchema>;
type ContributeItemParams = InferType<typeof itemContributionSchema>;
type ItemParams = InferType<typeof fullItemSchema>;
type ItemDrawParams = InferType<typeof fullItemDrawSchema>;
type DrawQueryParams = InferType<typeof drawQuerySchema>;

export type {
  CreateStudyParams,
  CreateParticipantParams,
  CreateSessionParams,
  CreateResponseParams,
  StudyParams,
  ParticipantParams,
  SessionParams,
  ResponseParams,
  CreateLeaderboardParams,
  CreateLeaderboardScoreParams,
  LeaderboardParams,
  LeaderboardScoreParams,
  CreateResponseRequestParams,
  CreateItemPoolParams,
  ItemPoolParams,
  ContributeItemParams,
  ItemParams,
  ItemDrawParams,
  DrawQueryParams,
};
