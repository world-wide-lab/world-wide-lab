// Remove all invalid characters from a studyId
function sanitizeStudyId(studyId: string) {
  return studyId.replace(/[^a-zA-Z0-9-_]+/g, "");
}

export { sanitizeStudyId };
