import config from "../../config.js";
import sequelize from "../../db/index.js";
import { Alert, type AlertOptions } from "./alert.js";

export class ScalingAlert extends Alert {
  private threshold: number;

  constructor() {
    const options: AlertOptions = {
      name: "ScalingAlert",
      emoji: ":chart_with_upwards_trend:",
      cooldown: config.alerts.cooldown,
      enabled: config.alerts.scaling_enabled,
    };
    super(options);
    this.threshold = config.alerts.scaling_threshold;
  }

  private lastInstanceCount = 0;
  protected async checkShouldSendAlert(): Promise<boolean> {
    const instanceCount = await sequelize.models.Instance.count();
    const threshold = this.isFiring
      ? Math.max(this.threshold, this.lastInstanceCount)
      : this.threshold;
    this.lastInstanceCount = instanceCount;
    return instanceCount > threshold;
  }

  protected createAlertMessage(): any {
    return this.createBaseMessage(
      "Scaling Alert",
      `The number of active instances \`${this.lastInstanceCount}\` exceeds the threshold of \`${this.threshold}\`.`,
    );
  }

  protected async getAlertDescription(): Promise<string> {
    return `${this.lastInstanceCount} instances detected`;
  }
}
