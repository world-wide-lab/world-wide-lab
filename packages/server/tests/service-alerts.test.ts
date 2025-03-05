// Set up fake environment variables
import "./setup_env.js";

import config from "../src/config.js";
import sequelize from "../src/db/index.js";
import { up } from "../src/db/migrate.js";
import { alertsService } from "../src/services/service-alerts.js";
import { instancesService } from "../src/services/service-instances.js";

// Override the config for testing
config.alerts.webhook_url = "https://fake-webhook.test";
config.alerts.cooldown = 1; // 1 second
config.alerts.check_interval = 0.5; // 0.5 seconds
config.alerts.scaling_threshold = 1; // Alert when more than 1 instance
config.alerts.sessions_threshold = 2; // Alert when more than 2 sessions
config.alerts.sessions_window = 60; // 1 minute window

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock fetch for webhook testing
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Mock instances service
vi.mock("../src/services/service-instances.js", async () => {
  const originalModule = await vi.importActual(
    "../src/services/service-instances.js",
  );
  return {
    ...originalModule,
    instancesService: {
      isPrimaryInstance: vi.fn().mockReturnValue(true), // Default to primary
    },
  };
});

describe("Alerts Service", () => {
  beforeAll(async () => {
    // Initialize Database
    await up();
  });

  beforeEach(async () => {
    // Clear tables before each test
    await sequelize.models.Instance.destroy({ where: {} });
    await sequelize.models.Session.destroy({ where: {} });

    // Reset the mocks
    vi.useFakeTimers();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, statusText: "OK" }),
    );

    // Reset the spy history
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await alertsService.onStop();
  });

  it("should only send alerts when running on primary instance", async () => {
    // Configure instances service to not be primary
    vi.mocked(instancesService.isPrimaryInstance).mockReturnValue(false);

    await alertsService.onStart();

    // Create conditions that would trigger an alert (multiple instances)
    await sequelize.models.Instance.bulkCreate([
      {
        ipAddress: "192.168.1.1",
        hostname: "instance-1",
        port: 8080,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        isPrimary: false,
        metadata: {},
      },
      {
        ipAddress: "192.168.1.2",
        hostname: "instance-2",
        port: 8081,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        isPrimary: true,
        metadata: {},
      },
      {
        ipAddress: "192.168.1.3",
        hostname: "instance-3",
        port: 8082,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        isPrimary: false,
        metadata: {},
      },
    ]);

    // @ts-ignore - Accessing private method for testing
    await alertsService.checkAlerts();

    // No webhook should be called because we're not primary
    expect(fetchMock).not.toHaveBeenCalled();

    // Now set to primary and check again
    vi.mocked(instancesService.isPrimaryInstance).mockReturnValue(true);

    // @ts-ignore - Accessing private method for testing
    await alertsService.checkAlerts();

    // Now webhook should be called
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].body).toContain("Scaling Alert");
  });

  it("should send scaling alert when instance count exceeds threshold", async () => {
    await alertsService.onStart();

    // Create instances to trigger alert
    await sequelize.models.Instance.bulkCreate([
      {
        ipAddress: "192.168.1.1",
        hostname: "instance-1",
        port: 8080,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        isPrimary: false,
        metadata: {},
      },
      {
        ipAddress: "192.168.1.2",
        hostname: "instance-2",
        port: 8081,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        isPrimary: true,
        metadata: {},
      },
    ]);

    // @ts-ignore - Accessing private method for testing
    await alertsService.checkAlerts();

    // Verify scaling alert was sent
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.text).toContain("chart_with_upwards_trend");
    expect(requestBody.blocks[1].text.text).toContain("active instances `2`");
    expect(requestBody.blocks[1].text.text).toContain("threshold of `1`");
  });

  it("should send sessions alert when session count exceeds threshold", async () => {
    await alertsService.onStart();

    // Create sessions to trigger alert
    await sequelize.models.Study.create({
      studyId: "alerts-service-test",
    });
    await sequelize.models.Session.bulkCreate([
      {
        sessionId: "94d6e26b-3dc2-44e6-9418-31238e116c12",
        studyId: "alerts-service-test",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sessionId: "a8592595-165e-472e-951f-3b22a802b952",
        studyId: "alerts-service-test",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        sessionId: "3ade25d8-8bb7-49ac-acf3-324dfc52a5c5",
        studyId: "alerts-service-test",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // @ts-ignore - Accessing private method for testing
    await alertsService.checkAlerts();

    // Verify sessions alert was sent
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.text).toContain("busts_in_silhouette");
    expect(requestBody.blocks[1].text.text).toContain("new sessions `3`");
    expect(requestBody.blocks[1].text.text).toContain("threshold `2`");
  });

  it("should respect cooldown period and not send duplicate alerts", async () => {
    await alertsService.onStart();

    // Create instances to trigger alert
    await sequelize.models.Instance.bulkCreate([
      {
        ipAddress: "192.168.1.1",
        hostname: "instance-1",
        port: 8080,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        isPrimary: false,
        metadata: {},
      },
      {
        ipAddress: "192.168.1.2",
        hostname: "instance-2",
        port: 8081,
        startTime: new Date(),
        lastHeartbeat: new Date(),
        isPrimary: true,
        metadata: {},
      },
    ]);

    // First check should send alert
    // @ts-ignore - Accessing private method for testing
    await alertsService.checkAlerts();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Reset mock
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, statusText: "OK" }),
    );

    // Second check immediately after should not send alert (cooldown)
    // @ts-ignore - Accessing private method for testing
    await alertsService.checkAlerts();
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance time beyond cooldown
    vi.advanceTimersByTime(config.alerts.cooldown * 1000 + 100); // Convert seconds to ms + 100ms

    // Now it should send alert again
    // @ts-ignore - Accessing private method for testing
    await alertsService.checkAlerts();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
