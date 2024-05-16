import type { Sequelize } from "sequelize";

async function ensureStudiesExist(sequelize: Sequelize, studyIds: string[]) {
  await Promise.all(
    studyIds.map((studyId) => ensureStudyExists(sequelize, studyId)),
  );
}

async function ensureStudyExists(sequelize: Sequelize, studyId: string) {
  const existingStudyCount = (
    await sequelize.models.Study.findAndCountAll({
      where: {
        studyId,
      },
    })
  ).count;

  if (existingStudyCount > 0) {
    // Study already exists
    return;
  }

  // Create study
  await sequelize.models.Study.create({
    studyId,
  });
}

export { ensureStudiesExist, ensureStudyExists };
