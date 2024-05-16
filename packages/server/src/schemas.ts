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

export {
  studySchema,
  participantSchema,
  sessionSchema,
  sessionCreationRequestSchema,
  responseSchema,
  fullStudySchema,
  fullParticipantSchema,
  fullSessionSchema,
  fullResponseSchema,
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

export type {
  CreateStudyParams,
  CreateParticipantParams,
  CreateSessionParams,
  CreateResponseParams,
  StudyParams,
  ParticipantParams,
  SessionParams,
  ResponseParams,
};
