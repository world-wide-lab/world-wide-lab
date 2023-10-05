import express, { Request, Response } from "express";
import Sequelize from "sequelize";

import sequelize from "../db";
import { requireAuthMiddleware } from "./authMiddleware";

const routerProtectedWithoutAuthentication = express.Router();

/**
 * @openapi
 * /study/{studyId}/data/{dataType}:
 *   get:
 *     summary: Download a study's data
 *     description: >
 *       Download data for a given study. Different dataTypes and formats are
 *       available for each study. The downloads may take a while depending
 *       on the amount of data and whether or not it needs to be transformed.
 *     tags:
 *       - main
 *     security:
 *      - apiKey: []
 *     parameters:
 *       - in: path
 *         name: studyId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID of the study to retrieve data for
 *       - in: path
 *         name: dataType
 *         schema:
 *           type: string
 *           enum: [
 *             responses-raw,
 *             sessions-raw,
 *             participants-raw,
 *             responses-extracted-payload
 *          ]
 *         required: true
 *         description: >
 *           Which type of data should be downloaded.
 *     responses:
 *       '200':
 *         description: Successfully downloaded study data
 *       '400':
 *         description: Study does not exist
 *       '401':
 *         description: Unauthorized, either the wrong apiKey or no apiKey has been supplied.
 *       '500':
 *         description: Failed to download study data
 */
routerProtectedWithoutAuthentication.get(
  "/study/:studyId/data/:dataType",
  async (req: Request, res: Response) => {
    try {
      const { studyId, dataType } = req.params;

      let study = await sequelize.models.Study.findOne({ where: { studyId } });
      if (!study) {
        res.status(400).json({ error: "Unknown studyId" });
        return;
      }

      let data;
      if (dataType == "responses-raw") {
        data = await sequelize.models.Response.findAll({
          include: {
            model: sequelize.models.Session,
            where: { studyId },
            attributes: ["participantId"],
          },
          raw: true,
        });
      } else if (dataType == "sessions-raw") {
        data = await sequelize.models.Session.findAll({
          where: { studyId },
          raw: true,
        });
      } else if (dataType == "participants-raw") {
        data = await sequelize.models.Participant.findAll({
          include: {
            model: sequelize.models.Session,
            where: { studyId },
            attributes: ["sessionId"],
          },
          raw: true,
        });
      } else if (dataType == "responses-extracted-payload") {
        const keysResult = await sequelize.query(
          `
        SELECT DISTINCT
          payload_json.key as key
        FROM
          wwl_responses
            INNER JOIN wwl_sessions ON (wwl_sessions."sessionId" = wwl_responses."sessionId"),
          json_each(payload) payload_json
        WHERE wwl_sessions."studyId" = :studyId
        ORDER BY key ASC;
      `,
          {
            type: Sequelize.QueryTypes.SELECT,
            replacements: { studyId },
          },
        );

        // Create a the list of keys in the payload in a safe format
        const jsonKeys = keysResult
          .map((row) => ("key" in row ? row.key : undefined))
          .filter((key) => key !== undefined);
        const jsonFieldsString = jsonKeys
          .map(
            (jsonKey) =>
              `wwl_responses."payload"->>'${jsonKey}' AS "${jsonKey}"`,
          )
          .join(", ");

        // Collect list of table fields, so we can select them without the payload
        const modelAttributes = sequelize.models.Response.getAttributes();
        const tableFields = Object.keys(modelAttributes);
        const fields = tableFields
          .filter((field) => field !== "payload")
          .map((field) => `wwl_responses."${field}"`);
        const tableFieldsString = fields.join(", ");

        // Combine the table and json fields
        const fieldsString =
          jsonKeys.length > 0
            ? `${tableFieldsString}, ${jsonFieldsString}`
            : `${tableFieldsString}`;

        // Create the final query
        data = await sequelize.query(
          `
        SELECT
          ${fieldsString}
        FROM wwl_responses
          INNER JOIN wwl_sessions ON (wwl_sessions."sessionId" = wwl_responses."sessionId")
        WHERE wwl_sessions."studyId" = :studyId;
      `,
          {
            type: Sequelize.QueryTypes.SELECT,
            replacements: { studyId },
          },
        );
      } else {
        throw new Error(`Unknown dataType: ${dataType}`);
      }
      res.status(200).json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to retrieve study data" });
    }
  },
);

const routerProtected = express.Router();
routerProtected.use(requireAuthMiddleware);
routerProtected.use(routerProtectedWithoutAuthentication);

export { routerProtected, routerProtectedWithoutAuthentication };
