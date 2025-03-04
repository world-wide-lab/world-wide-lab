/**
 * Abstract base class for services
 */
export abstract class Service {
  async onStart(): Promise<void> {
    // Default implementation does nothing
  }

  async onStop(): Promise<void> {
    // Default implementation does nothing
  }
}

/**
 * Array of registered services.
 */
export const services: Service[] = [];

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
