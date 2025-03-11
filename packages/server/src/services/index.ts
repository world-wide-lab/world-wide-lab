import config from "../config.js";
import { alertsService } from "./service-alerts.js";
import { instancesService } from "./service-instances.js";
import type Service from "./service.js";

/**
 * Array of registered services.
 */
export const services: Service[] = [];

if (config.instances.enabled) {
  services.push(instancesService);
}
if (config.alerts.enabled) {
  services.push(alertsService);
}

/**
 * Starts all registered services.
 * @returns Promise that resolves when all services have been started
 */
export async function startServices(): Promise<void> {
  for (const service of services) {
    await service.onStart();
  }
}

/**
 * Stops all registered services.
 * @returns Promise that resolves when all services have been stopped
 */
export async function stopServices(): Promise<void> {
  for (const service of services) {
    await service.onStop();
  }
}
