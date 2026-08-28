import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import Sequelize from "sequelize";

import { pipeline } from "node:stream/promises";
import type { Client } from "pg";
import { to as copyTo } from "pg-copy-streams";

import { date, number, object, string } from "yup";
import config from "../config.js";
import {
  type Cursor,
  KEYSET_CURSOR_COLUMN,
  type PageQuery,
  generateExtractedPayloadQuery,
  keysetExport,
} from "../db/export.js";
import sequelize from "../db/index.js";
import {
  castPrimaryKey,
  findModelByTableName,
  getColumnName,
  getPrimaryKeyAttribute,
  runReplication,
} from "../db/replication.js";
import { sanitizeStudyId } from "../db/util.js";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";
import { requireAuthMiddleware } from "./authMiddleware.js";

const routerProtectedWithoutAuthentication = express.Router();

/**
 * @openapi
 * /study/{studyId}/data/{dataType}/{format}:
 *   get:
 *     summary: Download a study's data
 *     description: >
 *       Download data for a given study. Different dataTypes and formats are
 *       available for each study. The downloads may take a while depending
 *       on the amount of data and whether or not it needs to be transformed.
 *     tags:
 *       - download
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
 *         name: format
 *         schema:
 *           type: string
 *           enum: [
 *            json,
 *            csv
 *          ]
 *         required: true
 *         description: >
 *           In which format should data be downloaded.
 *       - in: query
 *         name: created_after
 *         example: 2000-01-01T00:00:00Z
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Only retrieve data created after this date-time
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studyId, dataType, format } = object({
        studyId: string().required(),
        dataType: string()
          .oneOf([
            "responses-raw",
            "sessions-raw",
            "participants-raw",
            "responses-extracted-payload",
          ])
          .required(),
        format: string().oneOf(["json", "csv"]).required(),
      }).validateSync(req.params);

      const { created_after } = object({
        created_after: date(),
      }).validateSync(req.query);

      // Verify whether the study exists
      const study = await sequelize.models.Study.findOne({
        where: { studyId },
      });
      if (!study) {
        res.status(400).json({ error: "Unknown studyId" });
        return;
      }

      // Standard data export functions
      // Every export is paginated via a keyset (or "cursor") on a unique
      // column, so that pages neither get slower the further we go, nor risk
      // duplicating or skipping rows in between them.
      let queryPage: PageQuery | undefined;
      let cursorFields: string[] | undefined;
      let hiddenCursorFields: string[] = [];

      if (dataType === "responses-raw") {
        cursorFields = ["responseId"];
        queryPage = async (cursor: Cursor | undefined, limit: number) => {
          return await sequelize.models.Response.findAll({
            include: {
              model: sequelize.models.Session,
              where: { studyId },
              attributes: ["participantId"],
            },
            where: {
              ...(created_after && {
                createdAt: {
                  [Sequelize.Op.gte]: created_after,
                },
              }),
              ...(cursor !== undefined && {
                responseId: {
                  [Sequelize.Op.gt]: cursor[0],
                },
              }),
            },
            order: [["responseId", "ASC"]],
            raw: true,
            limit,
          });
        };
      } else if (dataType === "sessions-raw") {
        cursorFields = ["sessionId"];
        queryPage = async (cursor: Cursor | undefined, limit: number) => {
          return await sequelize.models.Session.findAll({
            where: {
              studyId,
              ...(created_after && {
                createdAt: {
                  [Sequelize.Op.gte]: created_after,
                },
              }),
              ...(cursor !== undefined && {
                sessionId: {
                  [Sequelize.Op.gt]: cursor[0],
                },
              }),
            },
            order: [["sessionId", "ASC"]],
            raw: true,
            limit,
          });
        };
      } else if (dataType === "participants-raw") {
        cursorFields = ["participantId"];
        queryPage = async (cursor: Cursor | undefined, limit: number) => {
          return await sequelize.models.Participant.findAll({
            include: {
              model: sequelize.models.Session,
              where: { studyId },
              attributes: [],
            },
            where: {
              ...(created_after && {
                createdAt: {
                  [Sequelize.Op.gte]: created_after,
                },
              }),
              ...(cursor !== undefined && {
                participantId: {
                  [Sequelize.Op.gt]: cursor[0],
                },
              }),
            },
            subQuery: false,
            group: ["Participant.participantId"],
            order: [["participantId", "ASC"]],
            raw: true,
            limit,
          });
        };
      } else if (dataType === "responses-extracted-payload") {
        const { query, pageQuery } = await generateExtractedPayloadQuery(
          sequelize,
          studyId,
          { created_after },
        );

        if (sequelize.getDialect() === "postgres" && format === "csv") {
          // Special case for postgres, use COPY to format & stream data

          // Manually replace the query's placeholders, as pg-copy-stream
          // doesn't support query parameters. Care should be taken here
          // to prevent SQL injection, which is why the studyId is sanitized
          // and created_after is re-serialized from its parsed Date.
          let copyQuery = query.replace(
            ":studyId",
            `'${sanitizeStudyId(studyId)}'`,
          );
          if (created_after) {
            copyQuery = copyQuery.replace(
              ":created_after",
              `'${created_after.toISOString()}'`,
            );
          }

          const connection = (await sequelize.connectionManager.getConnection({
            type: "read",
          })) as Client;
          const stream = connection.query(
            copyTo(
              `
                COPY
                  (${copyQuery})
                TO
                  STDOUT WITH (
                    FORMAT CSV, HEADER, FORCE_QUOTE *
                  );
              `,
            ),
          );
          // Set headers
          res.status(200).contentType("text/csv");
          // Stream results
          // @ts-ignore
          await pipeline(stream, res);

          // Return the connection to the pool
          sequelize.connectionManager.releaseConnection(connection);
          return;
        }

        // The cursor is selected under a reserved alias, which is hidden from
        // the exported data again, since a payload key could otherwise shadow
        // the responseId column it is based on.
        cursorFields = [KEYSET_CURSOR_COLUMN];
        hiddenCursorFields = [KEYSET_CURSOR_COLUMN];
        queryPage = async (cursor: Cursor | undefined, limit: number) => {
          return await sequelize.query(pageQuery(cursor !== undefined), {
            type: Sequelize.QueryTypes.SELECT,
            replacements: {
              studyId,
              limit,
              ...(cursor !== undefined && { cursor: cursor[0] }),
              ...(created_after && { created_after }),
            },
          });
        };
      } else {
        throw new Error(`Unknown dataType: ${dataType}`);
      }

      if (queryPage !== undefined && cursorFields !== undefined) {
        // Do a chunked export of the data, using the specified queryPage
        // function to retrieve one page of data at a time.
        await keysetExport(res, queryPage, format, {
          cursorFields,
          hiddenCursorFields,
        });
      } else {
        throw new Error("Missing queryPage function");
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /replication/source/get-table/{table}:
 *   get:
 *     summary: Retrieve a table's data for replication
 *     tags:
 *      - replication
 *     security:
 *      - apiKey: []
 *     description: >
 *       Retrieve data from a table for replication. The data will be returned
 *       as a JSON array. The data will be filtered to only include records
 *       updated after the specified date-time.
 *       Set REPLICATION_ROLE to 'source' to enable this feature.
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         example: wwl_responses
 *         schema:
 *           type: string
 *         description: The name of the table to retrieve data from
 *       - in: query
 *         name: limit
 *         required: true
 *         example: 10000
 *         schema:
 *           type: integer
 *         description: The maximum number of records to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: The offset of records to retrieve, typically this should be incremented by the limit for pagination
 *       - in: query
 *         name: updated_after
 *         example: 2000-01-01T00:00:00Z
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Only retrieve data updated after this date-time
 *     responses:
 *       200:
 *         description: A JSON array of the table's data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Invalid input, object invalid
 *       404:
 *         description: Table not found
 *       418:
 *         description: Server is not configured to serve as a replication source
 *       500:
 *         description: An error occurred while trying to export the table for replication
 */
routerProtectedWithoutAuthentication.get(
  "/replication/source/get-table/:table/",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (config.replication.role !== "source") {
        throw new AppError(
          "Serving as a replication source is not enabled. Set REPLICATION_ROLE to 'source' to enable this feature.",
          418,
        );
      }

      const { table } = req.params;
      const { updated_after, limit, offset, after_updated_at, after_id } =
        object({
          updated_after: date(),
          limit: number().required(),
          offset: number().default(0),
          after_updated_at: date(),
          after_id: string(),
        }).validateSync(req.query);

      // Find the correct model for the table
      const model = findModelByTableName(table);
      const primaryKey = getPrimaryKeyAttribute(model);

      // Rows are always ordered by ("updatedAt", primary key). "updatedAt"
      // alone is not unique, so on its own it cannot tell the database where
      // one page ends and the next one begins.
      const baseWhere = {
        ...(updated_after && {
          updatedAt: {
            [Sequelize.Op.gte]: updated_after,
          },
        }),
      };

      const usesKeyset =
        after_updated_at !== undefined || after_id !== undefined;
      if (
        usesKeyset &&
        (after_updated_at === undefined || after_id === undefined)
      ) {
        throw new AppError(
          "after_updated_at and after_id have to be supplied together",
          400,
        );
      }
      if (!usesKeyset && offset > 0) {
        logger.warn(
          `Replication source received an offset-paginated request for "${table}". Offsets get slower the further they go and cannot guarantee a stable order; the destination should be updated to use after_updated_at / after_id instead.`,
        );
      }

      // Continue right after the row identified by the caller's cursor. This
      // is a row value comparison on purpose: it is the form the database can
      // answer with a single seek into the ("updatedAt", primary key) index,
      // whereas the equivalent "a > x OR (a = x AND b > y)" makes it scan and
      // discard everything before the cursor instead.
      const quote = (attribute: string) =>
        sequelize
          .getQueryInterface()
          .quoteIdentifier(getColumnName(model, attribute));
      const cursorCondition = Sequelize.literal(
        `(${quote("updatedAt")}, ${quote(primaryKey)}) > (:afterUpdatedAt, :afterId)`,
      );

      const initialCursor: Cursor | undefined = usesKeyset
        ? [
            after_updated_at as Date,
            castPrimaryKey(model, primaryKey, after_id as string),
          ]
        : undefined;

      const queryPage = async (
        cursor: Cursor | undefined,
        pageSize: number,
      ) => {
        // The first page continues from the cursor the caller supplied (if
        // any), every page after that from the previous page's last row.
        const after = cursor ?? initialCursor;

        return await model.findAll({
          where: after
            ? { [Sequelize.Op.and]: [baseWhere, cursorCondition] }
            : baseWhere,
          ...(after && {
            replacements: { afterUpdatedAt: after[0], afterId: after[1] },
          }),
          order: [
            ["updatedAt", "ASC"],
            [primaryKey, "ASC"],
          ],
          raw: true,
          limit: pageSize,
          // Legacy, offset-paginated callers still get their requested
          // offset, but only on the first page. Every page after that
          // continues from the previous page's last row, so the offset is
          // paid once instead of once per chunk.
          ...(!usesKeyset && cursor === undefined && offset > 0 && { offset }),
        });
      };

      // Do a chunked export of the data
      await keysetExport(res, queryPage, "json", {
        cursorFields: ["updatedAt", primaryKey],
        limit,
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /replication/destination/update:
 *   get:
 *     summary: Update the replication destination
 *     tags:
 *      - replication
 *     security:
 *      - apiKey: []
 *     description: >
 *       Update the replication destination by running the replication process.
 *       Set REPLICATION_ROLE to 'destination' to enable this feature.
 *     responses:
 *       200:
 *         description: Success
 *       418:
 *         description: Server is not configured to serve as a replication destination
 *       400:
 *         description: Invalid input, object invalid
 *       404:
 *         description: Table not found
 *       500:
 *         description: An error occurred while trying to export the table for replication
 */
routerProtectedWithoutAuthentication.get(
  "/replication/destination/update",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (config.replication.role !== "destination") {
        throw new AppError(
          "Serving as a replication destination is not enabled. Set REPLICATION_ROLE to 'destination' to enable this feature.",
          418,
        );
      }

      await runReplication();

      res.status(200).json({ message: "Success!" });
    } catch (error) {
      next(error);
    }
  },
);

const routerProtected = express.Router();
routerProtected.use(requireAuthMiddleware);
routerProtected.use(routerProtectedWithoutAuthentication);

export { routerProtected, routerProtectedWithoutAuthentication };
