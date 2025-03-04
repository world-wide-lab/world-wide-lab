/**
 * Abstract base class for services
 */
export default abstract class Service {
  async onStart(): Promise<void> {
    // Default implementation does nothing
  }

  async onStop(): Promise<void> {
    // Default implementation does nothing
  }
}
