import Sequelize from "sequelize";
import config from "../../config.js";
import sequelize from "../../db/index.js";
import { Alert, type AlertOptions } from "./alert.js";

export class SessionsAlert extends Alert {
  private threshold: number;
  private window: number;

  constructor() {
    const options: AlertOptions = {
      name: "SessionsAlert",
      emoji: ":busts_in_silhouette:",
      cooldown: config.alerts.cooldown,
      enabled: config.alerts.sessions_enabled,
    };
    super(options);

    this.threshold = config.alerts.sessions_threshold;
    this.window = config.alerts.sessions_window;
  }

  private lastSessionCount = 0;
  protected async checkShouldSendAlert(): Promise<boolean> {
    const sessionCount = await this.getSessionCount();
    const threshold = this.isFiring
      ? Math.max(this.threshold, this.lastSessionCount)
      : this.threshold;
    this.lastSessionCount = sessionCount;
    return sessionCount > threshold;
  }

  protected createAlertMessage(): any {
    return this.createBaseMessage(
      "Sessions Alert",
      `The number of new sessions \`${this.lastSessionCount}\` in the last ${this.window} seconds exceeds the threshold \`${this.threshold}\`.`,
    );
  }

  protected async getAlertDescription(): Promise<string> {
    return `${this.lastSessionCount} new sessions detected`;
  }

  private async getSessionCount(): Promise<number> {
    const windowStart = new Date(Date.now() - this.window * 1000);

    return await sequelize.models.Session.count({
      where: {
        createdAt: {
          [Sequelize.Op.gte]: windowStart,
        },
      },
    });
  }
}
