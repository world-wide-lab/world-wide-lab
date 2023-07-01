import { Sequelize } from 'sequelize'

async function generateExampleData (sequelize: Sequelize) {
  const studyId = "example"

  const exampleStudyCount = (await sequelize.models.Study.findAndCountAll({
    where: {
      studyId
    }
  })).count

  if (exampleStudyCount > 0) {
    // Data has already been generated
    return
  }
  console.log("Generating Example Data")
  await sequelize.models.Study.create({
      studyId,
  })

  async function generateParticipantData(info: Object, runs: Array<number>) {
    const participant = await sequelize.models.Participant.create({ info })
    for (let runIndex = 0; runIndex < runs.length; runIndex++) {
      const n_responses = runs[runIndex];
      const run = await sequelize.models.Run.create({
        // @ts-ignore
        participantId: participant.participantId,
        studyId,
      })
      const responses = []
      for (let index = 1; index <= n_responses; index++) {
        responses.push({
          // @ts-ignore
          runId: run.runId,
          name: `trial-${index}`,
          payload: {
            response: `Response #${index}`,
          },
        })
      }
      await sequelize.models.Response.bulkCreate(responses)
    }
  }

  await generateParticipantData({
    description: "Example User #1",
  }, [3, 1])
  await generateParticipantData({
    description: "Example User #2",
  }, [3])
}

export default generateExampleData;
