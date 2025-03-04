import os from "node:os";
import Sequelize from "sequelize";
import config from "../config.js";
import sequelize from "../db/index.js";
import { logger } from "../logger.js";
import Service from "./service.js";

// How often to update the heartbeat (in ms)
const HEARTBEAT_INTERVAL = 3 * 60 * 1000;
// How old an instance can be before it's considered stale (in ms)
const STALE_THRESHOLD = HEARTBEAT_INTERVAL * 3;
// How often to check primary status (in ms)
const PRIMARY_CHECK_INTERVAL = HEARTBEAT_INTERVAL * 2;

class InstancesService extends Service {
  private instanceId: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private primaryCheckInterval: NodeJS.Timeout | null = null;
  private isPrimary = false;

  async onStart(): Promise<void> {
    // Register this instance
    await this.registerInstance();

    // Start periodic heartbeat
    this.heartbeatInterval = setInterval(
      () => this.updateHeartbeat(),
      HEARTBEAT_INTERVAL,
    );

    // Start periodic primary instance check
    this.primaryCheckInterval = setInterval(async () => {
      await this.checkPrimaryStatus();

      await this.cleanupStaleInstances();
    }, PRIMARY_CHECK_INTERVAL);
  }

  async onStop(): Promise<void> {
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.primaryCheckInterval) {
      clearInterval(this.primaryCheckInterval);
      this.primaryCheckInterval = null;
    }

    // Remove this instance from the database
    await this.deregisterInstance();
  }

  private async registerInstance(): Promise<void> {
    try {
      const ipAddress = this.getIpAddress();
      const hostname = os.hostname();

      const instance = await sequelize.models.Instance.create({
        ipAddress,
        hostname,
        port: config.port,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        isPrimary: false,
        metadata: this.getMetadata(),
      });
      // @ts-ignore
      this.instanceId = instance.instanceId;
      logger.info(`Instance registered with ID: ${this.shortInstanceId}`);

      // Check primary status immediately after registration
      await this.checkPrimaryStatus();
    } catch (error) {
      logger.error("Failed to register instance:", error);
    }
  }

  private async updateHeartbeat(): Promise<void> {
    try {
      await sequelize.models.Instance.update(
        {
          lastHeartbeat: new Date(),
          metadata: this.getMetadata(),
        },
        { where: { instanceId: this.instanceId } },
      );
    } catch (error) {
      logger.error("Failed to update heartbeat:", error);
    }
  }

  private async checkPrimaryStatus(): Promise<void> {
    if (!this.instanceId) return;

    try {
      const staleThreshold = new Date(Date.now() - STALE_THRESHOLD);

      // Find all non-stale instances (ordered by start time)
      const instances = await sequelize.models.Instance.findAll({
        where: {
          lastHeartbeat: {
            [Sequelize.Op.gt]: staleThreshold,
          },
        },
        order: [["startTime", "ASC"]],
      });

      if (instances.length === 0) {
        logger.warn(
          `No active instances found when checking for primary status. The current instance (${this.shortInstanceId}) seems to not be visible?`,
        );
      }

      // Check if this instance is the oldest non-stale instance
      const isOldest =
        instances.length > 0 &&
        instances[0].getDataValue("instanceId") === this.instanceId;

      if (!this.isPrimary && isOldest) {
        // If this is the oldest, claim primary status
        await this.setPrimaryStatus(true);
      } else if (this.isPrimary && !isOldest) {
        // If this instance is primary but not the oldest anymore, release primary status
        await this.setPrimaryStatus(false);
      }
    } catch (error) {
      logger.error("Error when checking primary status:", error);
    }
  }

  private async setPrimaryStatus(value: boolean): Promise<void> {
    try {
      // Update database to mark this instance as primary
      await sequelize.models.Instance.update(
        { isPrimary: value },
        { where: { instanceId: this.instanceId } },
      );

      this.isPrimary = value;

      if (value) {
        logger.info(
          `Instance ${this.shortInstanceId} is now the primary instance.`,
        );
      }
    } catch (error) {
      logger.error("Failed to set primary status:", error);
    }
  }

  private async cleanupStaleInstances(): Promise<void> {
    // Only the primary instance should run the cleanup
    if (!this.isPrimary) return;

    try {
      const staleThreshold = new Date(Date.now() - STALE_THRESHOLD);

      const deletedCount = await sequelize.models.Instance.destroy({
        where: {
          lastHeartbeat: {
            [Sequelize.Op.lt]: staleThreshold,
          },
        },
      });

      if (deletedCount > 0) {
        logger.info(
          `Primary instance ${this.shortInstanceId} cleaned up ${deletedCount} stale instance(s)`,
        );
      }
    } catch (error) {
      logger.error("Failed to cleanup stale instances:", error);
    }
  }

  private async deregisterInstance(): Promise<void> {
    try {
      await sequelize.models.Instance.destroy({
        where: { instanceId: this.instanceId },
      });
      logger.info(`Instance ${this.shortInstanceId} deregistered`);
    } catch (error) {
      logger.error("Failed to deregister instance:", error);
    }
  }

  private getIpAddress(): string {
    const networks = os.networkInterfaces();
    for (const name of Object.keys(networks)) {
      for (const net of networks[name] || []) {
        // Skip internal and non-IPv4 addresses
        if (!net.internal && net.family === "IPv4") {
          return net.address;
        }
      }
    }
    return "n/a";
  }

  private get shortInstanceId(): string {
    return this.instanceId ? this.instanceId.slice(0, 8) : "n/a";
  }

  private getMetadata() {
    return {
      version: config.version,
      systemUptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpus: os.cpus().length,
      memory: os.totalmem(),
      freeMemory: os.freemem(),
    };
  }

  /**
   * Returns whether this instance is currently the primary instance
   */
  public isPrimaryInstance(): boolean {
    return this.isPrimary;
  }
}

export const instancesService = new InstancesService();
