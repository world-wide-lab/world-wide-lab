import Sequelize from "sequelize";
import config from "../config.js";
import sequelize from "../db/index.js";
import { logger } from "../logger.js";
import { type Alert, ScalingAlert, SessionsAlert } from "./alerts/index.js";
import { instancesService } from "./instances-service.js";
import Service from "./service.js";

class AlertsService extends Service {
  private checkInterval: NodeJS.Timeout | null = null;
  private alerts: Alert[] = [];

  depends_on: Service[] = [instancesService];

  async onStart(): Promise<void> {
    if (!config.alerts.webhook_url) {
      logger.error("Alert service is enabled, but no webhook URL configured");
      return;
    }

    // Initialize alerts
    this.alerts = [new ScalingAlert(), new SessionsAlert()];

    logger.info(
      "Starting alerts service (checks will only run on primary instance)",
    );
    this.checkInterval = setInterval(
      () => this.checkAlerts(),
      config.alerts.check_interval * 1000, // Convert to ms
    );

    // Run an initial check
    this.checkAlerts();
  }

  async onStop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkAlerts(): Promise<void> {
    try {
      // Only check metrics if this is the primary instance (or when developing)
      if (
        !instancesService.isPrimaryInstance() &&
        process.env.NODE_ENV !== "development"
      ) {
        return;
      }

      // Check each alert
      for (const alert of this.alerts) {
        await alert.check();
      }
    } catch (error) {
      logger.error("Error checking alert metrics:", error);
    }
  }
}

export const alertsService = new AlertsService();
