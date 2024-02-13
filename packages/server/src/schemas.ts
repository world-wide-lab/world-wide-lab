// Schemas to power Data Validation for the Data Models

import {
  object,
  string,
  date,
  boolean,
  number,
  InferType,
  ValidationError,
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
  "metadata",
]);

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
  responseSchema,
  fullStudySchema,
  fullParticipantSchema,
  fullSessionSchema,
  fullResponseSchema,
  ValidationError,
};

type StudyParams = InferType<typeof studySchema>;
type ParticipantParams = InferType<typeof participantSchema>;
type SessionParams = InferType<typeof sessionSchema>;
type ResponseParams = InferType<typeof responseSchema>;

export type { StudyParams, ParticipantParams, SessionParams, ResponseParams };
