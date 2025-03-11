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
}).noUnknown();
const responseSchema = fullResponseSchema.omit([
  "responseId",
  "createdAt",
  "updatedAt",
]);

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

export {
  studySchema,
  participantSchema,
  sessionSchema,
  sessionCreationRequestSchema,
  responseSchema,
  leaderboardSchema,
  leaderboardScoreSchema,
  fullStudySchema,
  fullParticipantSchema,
  fullSessionSchema,
  fullResponseSchema,
  fullLeaderboardSchema,
  fullLeaderboardScoreSchema,
  ValidationError,
};

type CreateStudyParams = InferType<typeof studySchema>;
type CreateParticipantParams = InferType<typeof participantSchema>;
type CreateSessionParams = InferType<typeof sessionSchema>;
type CreateResponseParams = InferType<typeof responseSchema>;
type StudyParams = InferType<typeof fullStudySchema>;
type ParticipantParams = InferType<typeof fullParticipantSchema>;
type SessionParams = InferType<typeof fullSessionSchema>;
type ResponseParams = InferType<typeof fullResponseSchema>;
type CreateLeaderboardParams = InferType<typeof leaderboardSchema>;
type CreateLeaderboardScoreParams = InferType<typeof leaderboardScoreSchema>;
type LeaderboardParams = InferType<typeof fullLeaderboardSchema>;
type LeaderboardScoreParams = InferType<typeof fullLeaderboardScoreSchema>;

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
};
