/**
 * Abstract base class for services
 */
export default abstract class Service {
  // Services that this service depends upon
  // TODO: Implement dependency injection / verification that other services are running
  depends_on: Service[] = [];

  async onStart(): Promise<void> {
    // Default implementation does nothing
  }

  async onStop(): Promise<void> {
    // Default implementation does nothing
  }
}
