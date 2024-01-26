import express, { Request, Response } from "express";
import Sequelize from "sequelize";

import type { Client } from "pg";
import { to as copyTo } from "pg-copy-streams";
import { pipeline } from "node:stream/promises";
import { json2csv } from "json-2-csv";

import sequelize from "../db";
import { requireAuthMiddleware } from "./authMiddleware";
import { sanitizeStudyId } from "../db/util";
import { generateExtractedPayloadQuery, paginatedExport } from "../db/export";
import config from "../config";

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
 *       - in: path
 *         name: dataType
 *         schema:
 *           type: string
 *           enum: [
 *            json,
 *            csv
 *          ]
 *         required: true
 *         description: >
 *           In which format should data be downloaded.
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
  "/study/:studyId/data/:dataType/:format",
  async (req: Request, res: Response) => {
    try {
      const { studyId, dataType, format } = req.params;

      // Verify whether the study exists
      let study = await sequelize.models.Study.findOne({ where: { studyId } });
      if (!study) {
        res.status(400).json({ error: "Unknown studyId" });
        return;
      }

      // Standard data export functions
      let dataQueryFunction;
      if (dataType == "responses-raw") {
        dataQueryFunction = async (offset: number, limit: number) => {
          return await sequelize.models.Response.findAll({
            include: {
              model: sequelize.models.Session,
              where: { studyId },
              attributes: ["participantId"],
            },
            raw: true,

            offset,
            limit,
          });
        };
      } else if (dataType == "sessions-raw") {
        dataQueryFunction = async (offset: number, limit: number) => {
          return await sequelize.models.Session.findAll({
            where: { studyId },
            raw: true,

            offset,
            limit,
          });
        };
      } else if (dataType == "participants-raw") {
        dataQueryFunction = async (offset: number, limit: number) => {
          return await sequelize.models.Participant.findAll({
            include: {
              model: sequelize.models.Session,
              where: { studyId },
              attributes: ["sessionId"],
            },
            raw: true,

            offset,
            limit,
          });
        };
      } else if (dataType == "responses-extracted-payload") {
        const exportQuery = await generateExtractedPayloadQuery(
          sequelize,
          studyId,
        );

        if (sequelize.getDialect() === "postgres" && format === "csv") {
          // Special case for postgres, use COPY to format & stream data
          const connection = (await sequelize.connectionManager.getConnection({
            type: "read",
          })) as Client;
          const stream = connection.query(
            copyTo(
              // Manually replace the studyId placeholder, as pg-copy-stream
              // doesn't support query parameters. Care should be taken here
              // to prevent SQL injection.
              `
                COPY
                  (${exportQuery.replace(
                    ":studyId",
                    "'" + sanitizeStudyId(studyId) + "'",
                  )})
                TO
                  STDOUT WITH (
                    FORMAT CSV, HEADER, FORCE_QUOTE *
                  );
              `,
            ),
            [studyId],
          );
          // Set headers
          res.status(200).contentType("text/csv");
          // Stream results
          // @ts-ignore
          await pipeline(stream, res);
          return;
        } else {
          dataQueryFunction = async (offset: number, limit: number) => {
            return await sequelize.query(
              exportQuery + ` LIMIT ${limit} OFFSET ${offset}`,
              {
                type: Sequelize.QueryTypes.SELECT,
                replacements: { studyId },
              },
            );
          };
        }
      } else {
        throw new Error(`Unknown dataType: ${dataType}`);
      }

      if (dataQueryFunction !== undefined) {
        // Do a pagninated (or chunked) export of the data using the specified
        // dataQueryFunction to retrieve chunks of data.
        paginatedExport({
          pageSize: config.database.chunkSize,
          queryData: dataQueryFunction,
          // Initialize the data export
          onStart: () => {
            if (format === "json") {
              res.status(200).contentType("application/json");

              res.write("[");
            } else if (format === "csv") {
              res.status(200).contentType("text/csv");
            }
          },
          // Process & return each chunk of data
          onData: async (data, offset) => {
            if (format === "json") {
              // Convert data to JSON string
              const json = JSON.stringify(data);

              if (offset > 0) {
                // Add comma in between JSON chunks
                res.write(",");
              }

              // Remove first and last characters from JSON string
              // They should be "[" and "]" respectively.
              // Since we want to combine data from multiple chunks, we have to
              // remove them within every chunk and only add them once in
              // onStart and onEnd.
              res.write(json.substring(1, json.length - 1));
            } else if (format === "csv") {
              // Only include header in first chunk
              const prependHeader = offset === 0;

              if (offset > 0) {
                // Add newline in between CSV chunks
                res.write("\n");
              }

              // Convert to CSV
              res.write(
                json2csv(data, {
                  prependHeader,
                  expandNestedObjects: false,
                  useDateIso8601Format: true,
                }),
              );
            } else {
              throw new Error(`Unknown format: ${format}`);
            }
          },
          // Complete the data export
          onEnd: () => {
            if (format === "json") {
              res.write("]");
            }

            // Mark the response as finished
            res.end();
          },
        });
      } else {
        throw new Error(`Missing dataQueryFunction`);
      }
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
