import os from "node:os";
import config from "../../config.js";
import { logger } from "../../logger.js";

export interface AlertOptions {
  name: string;
  emoji: string;
  cooldown: number;
  enabled: boolean;
}

export abstract class Alert {
  protected lastAlertSent: Date | null = null;
  protected options: AlertOptions;
  protected isFiring = false;

  constructor(options: AlertOptions) {
    this.options = options;
  }

  async check(): Promise<void> {
    try {
      if (!this.options.enabled) {
        return;
      }

      // Only check if cooldown period is over
      if (
        this.lastAlertSent &&
        Date.now() - this.lastAlertSent.getTime() < this.options.cooldown * 1000 // Convert seconds to ms
      ) {
        return;
      }

      const shouldAlert = await this.checkShouldSendAlert();
      if (shouldAlert) {
        const message = this.createAlertMessage();
        await this.sendWebhook(message);
        this.lastAlertSent = new Date();
        logger.info(
          `Sent ${this.options.name} - ${await this.getAlertDescription()}`,
        );
      }
      this.isFiring = shouldAlert;
    } catch (error) {
      logger.error(`Error checking ${this.options.name}:`, error);
    }
  }

  protected abstract checkShouldSendAlert(): Promise<boolean>;
  protected abstract createAlertMessage(): any;
  protected abstract getAlertDescription(): Promise<string>;

  protected async sendWebhook(message: object): Promise<void> {
    try {
      if (!config.alerts.webhook_url) {
        logger.error("Cannot send alert - no webhook URL configured");
        return;
      }

      const response = await fetch(config.alerts.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        logger.error(
          `Failed to send webhook alert: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      logger.error("Error sending webhook alert:", error);
    }
  }

  protected createBaseMessage(title: string, text: string): any {
    return {
      text: `${this.options.emoji} *${title}*`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `${this.options.emoji} ${title}`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "image",
              image_url: "https://worldwidelab.org/favicon.png",
              alt_text: "The World-Wide-Lab Logo",
            },
            {
              type: "mrkdwn",
              text: `*Hostname:* ${os.hostname()} | *Time:* ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };
  }
}
