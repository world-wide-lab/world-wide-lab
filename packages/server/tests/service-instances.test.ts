// Set up fake environment variables
import "./setup_env.js";

import config from "../src/config.js";
import sequelize from "../src/db/index.js";
import { up } from "../src/db/migrate.js";
import { instancesService } from "../src/services/service-instances.js";

// Override the config to ensure instances are enabled for tests
config.instances.enabled = true;
config.instances.visible = true;

// Add vi import for mocking
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock os.networkInterfaces to return a consistent IP
vi.mock("node:os", async () => {
  const originalModule = await vi.importActual("node:os");
  const mockedModule = {
    ...originalModule,
    networkInterfaces: () => ({
      eth0: [
        {
          address: "192.168.1.2",
          netmask: "255.255.255.0",
          family: "IPv4",
          mac: "00:00:00:00:00:00",
          internal: false,
          cidr: "192.168.1.2/24",
        },
      ],
    }),
    hostname: () => "test-host",
  };

  // Ensure default export is handled properly
  return Object.defineProperty(mockedModule, "default", {
    value: mockedModule,
    enumerable: false,
  });
});

describe("Instances Service", () => {
  beforeAll(async () => {
    // Initialize Database
    await up();
  });

  beforeEach(async () => {
    // Clear instances table before each test
    await sequelize.models.Instance.destroy({ where: {} });

    // Reset the mocks
    vi.useFakeTimers();

    // Reset the spy history
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await instancesService.onStop();
  });

  it("should register an instance when started", async () => {
    await instancesService.onStart();

    const instances = await sequelize.models.Instance.findAll();
    expect(instances.length).toBe(1);

    const instance = instances[0];
    expect(instance.getDataValue("ipAddress")).toBe("192.168.1.2");
    expect(instance.getDataValue("hostname")).toBe("test-host");
    expect(instance.getDataValue("port").toString()).toBe(
      config.port.toString(),
    );

    // Should become primary since it's the only instance
    expect(instancesService.isPrimaryInstance()).toBe(true);
  });

  it("should update heartbeat", async () => {
    await instancesService.onStart();

    // Get the initial instance
    let instances = await sequelize.models.Instance.findAll();
    const initialHeartbeat = instances[0].getDataValue("lastHeartbeat");
    const instanceId = instances[0].getDataValue("instanceId");

    vi.advanceTimersByTime(1000 * 60 * 5);

    // Check if heartbeat was updated
    instances = await sequelize.models.Instance.findAll();
    expect(instances.length).toBe(1);
    expect(instances[0].getDataValue("instanceId")).toBe(instanceId);
    expect(instances[0].getDataValue("lastHeartbeat")).not.toEqual(
      initialHeartbeat,
    );
    expect(instances[0].getDataValue("lastHeartbeat")).toBeInstanceOf(Date);
    const updatedHeartbeat = instances[0].getDataValue("lastHeartbeat");
    expect(updatedHeartbeat.getTime()).toBeGreaterThan(
      initialHeartbeat.getTime(),
    );
  });

  it("should select the oldest instance as primary", async () => {
    // Create a manual instance that will be older
    const olderInstance = await sequelize.models.Instance.create({
      ipAddress: "192.168.1.100",
      hostname: "old-instance",
      port: 8080,
      startTime: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      lastHeartbeat: new Date(),
      isPrimary: false,
      metadata: {},
    });

    // Start our instance service (which will create a new instance)
    await instancesService.onStart();

    // Check instances
    const instances = await sequelize.models.Instance.findAll({
      order: [["startTime", "ASC"]],
    });
    expect(instances.length).toBe(2);

    // Our instance shouldn't be primary
    expect(instancesService.isPrimaryInstance()).toBe(false);

    // Update the lastHeartbeat of the older instance to be stale and for ours to be up-to-date
    await sequelize.models.Instance.update(
      { lastHeartbeat: new Date(Date.now() - 1000 * 60 * 15) }, // Make heartbeat very old
      { where: { instanceId: olderInstance.getDataValue("instanceId") } },
    );

    // Note: We have to manually trigger interval methods, as they are
    // asynchronous and we else end up with race conditions, where they only
    // complete after the tests are finished.

    // @ts-ignore - Accessing private method for testing only
    await instancesService.updateHeartbeat();
    // @ts-ignore - Accessing private method for testing only
    await instancesService.checkPrimaryStatus();
    // @ts-ignore - Accessing private method for testing only
    await instancesService.cleanupStaleInstances();

    // Now our instance should be primary
    expect(instancesService.isPrimaryInstance()).toBe(true);

    // The Old Instance should be cleaned up
    const instancesAfter = await sequelize.models.Instance.findAll({
      order: [["startTime", "ASC"]],
    });
    expect(instancesAfter.length).toBe(1);
  });
});
