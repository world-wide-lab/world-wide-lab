// Set up fake environment variables
import "./setup_env";

import request from 'supertest';
import sequelize from '../src/db';
import app from '../src/app';

const STUDY_ID = 'abc123';

describe('API Routes', () => {
  beforeAll(async () => {
    // Initialize Database
    await sequelize.sync();
  });

  // afterAll(async () => {
  //   // TODO: Clean up any test data
  // });

  let participantId: string;
  let runId: string;
  let studyId: string = STUDY_ID;

  describe('POST /participant', () => {
    it('should create a new participant', async () => {
      const response = await request(app)
        .post('/v1/participant')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('participantId');

      // Set the shared participantId
      participantId = response.body.participantId;
    });
  });

  describe('PUT /participant/:participantId', () => {
    it('should update an existing participant', async () => {
      const response = await request(app)
        .put('/v1/participant/' + participantId)
        .send({ info: { lorem: 'ipsum' } });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      const user = await sequelize.models.Participant.findOne({
        where: { participantId }
      })
      expect(user).toHaveProperty('info', { lorem: 'ipsum' });
    });
  });

  describe('POST /study', () => {
    it('should create a new study', async () => {
      const response = await request(app)
        .post('/v1/study')
        .send({ studyId: STUDY_ID});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('studyId');
    });
  });

  describe('POST /run', () => {
    it('should start a new run', async () => {
      const response = await request(app)
        .post('/v1/run')
        .send({ participantId, studyId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('participantId', participantId);
      expect(response.body).toHaveProperty('studyId', studyId);

      // Set the shared runId
      runId = response.body.runId;
    });
  });

  describe('POST /run/finish', () => {
    it('should mark a run as finished', async () => {
      const response = await request(app)
        .post('/v1/run/finish')
        .send({ runId: runId });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      const run = await sequelize.models.Run.findOne({
        where: { runId }
      })
      expect(run).toHaveProperty('finished', true);
    });
  });

  describe('PUT /run/:runId', () => {
    it('should update a run', async () => {
      const response = await request(app)
        .put('/v1/run/' + runId)
        .send({ info: { lorem: 'ipsum' } });

      expect(response.status).toBe(200);
      expect(response.body).toMatchSnapshot();

      const run = await sequelize.models.Run.findOne({
        where: { runId }
      })
      expect(run).toHaveProperty('info', { lorem: 'ipsum' });
    });
  });

  describe('POST /response', () => {
    it('should submit a response', async () => {
      const response = await request(app)
        .post('/v1/response')
        .send({
          runId,
          name: 'test_trail',
          payload: {
            key_1: 'value 1',
            key_2: 'value 2',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('responseId');
      const { responseId } = response.body;

      const runResponse = await sequelize.models.Response.findOne({
        where: { responseId }
      })
      expect(runResponse).toHaveProperty('runId', runId);
      expect(runResponse).toHaveProperty('name', 'test_trail');
      expect(runResponse).toHaveProperty('payload', { key_1: 'value 1', key_2: 'value 2', });
    });
  });
});
