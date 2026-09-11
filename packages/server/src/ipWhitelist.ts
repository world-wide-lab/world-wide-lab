import type { NextFunction, Request, RequestHandler, Response } from "express";
import ipaddr from "ipaddr.js";

import config from "./config.js";
import { logger } from "./logger.js";

type IpAddress = ReturnType<typeof ipaddr.parse>;
// An IP range, consisting of an address and the number of significant bits
type IpRange = [IpAddress, number];

/**
 * Parse a list of IPs and / or subnets (in CIDR notation) into ranges, which
 * can be matched against.
 *
 * @param entries List of IPs / subnets e.g. ["127.0.0.1", "10.0.0.0/8"]
 * @param name Name of the corresponding option, used in error messages.
 * @returns The parsed ranges.
 */
function parseIpWhitelist(entries: string[], name: string): IpRange[] {
  return entries
    .filter((entry) => entry !== "")
    .map((entry): IpRange => {
      try {
        if (entry.includes("/")) {
          return ipaddr.parseCIDR(entry);
        }
        const address = ipaddr.parse(entry);
        // A plain IP address is a range only matching itself
        return [address, address.kind() === "ipv6" ? 128 : 32];
      } catch {
        throw new Error(
          `Invalid entry in ${name}: "${entry}". Entries must either be IP addresses (e.g. "127.0.0.1" or "::1") or subnets in CIDR notation (e.g. "10.0.0.0/8" or "2001:db8::/32").`,
        );
      }
    });
}

/**
 * Check whether an IP address is part of any of the provided ranges.
 *
 * @param ip The IP address to check.
 * @param ranges The ranges to check against.
 * @returns Whether the IP is part of at least one of the ranges.
 */
function isIpWhitelisted(ip: string | undefined, ranges: IpRange[]): boolean {
  if (!ip) {
    return false;
  }

  let address: IpAddress;
  try {
    // process() turns IPv4-mapped IPv6 addresses (e.g. "::ffff:127.0.0.1",
    // which is what node reports for IPv4 clients on dual-stack sockets) into
    // their plain IPv4 equivalent.
    address = ipaddr.process(ip);
  } catch {
    // If we can't even parse the address, we can't whitelist it
    return false;
  }

  return ranges.some(([rangeAddress, bits]) => {
    // match() throws when comparing IPv4 with IPv6 addresses
    if (rangeAddress.kind() !== address.kind()) {
      return false;
    }
    return address.match(rangeAddress, bits);
  });
}

/**
 * Determine the IP address a request originated from.
 *
 * Note that req.ip takes the TRUST_PROXY setting into account, i.e. it will
 * only rely on headers such as X-Forwarded-For if proxies are being trusted.
 */
function getRequestIp(req: Request): string | undefined {
  return req.ip || req.socket.remoteAddress || undefined;
}

/**
 * Create a middleware, which only lets requests from whitelisted IPs pass.
 *
 * Requests from non-whitelisted IPs are ignored completely: their connection
 * is destroyed without any response being sent, which makes it harder to
 * e.g. scan the server for vulnerabilities.
 *
 * @param entries List of whitelisted IPs / subnets. If it's empty, all
 *   requests are allowed to pass through.
 * @param name Name of the corresponding option, used in error and log messages.
 */
function createIpWhitelistMiddleware(
  entries: string[],
  name: string,
): RequestHandler {
  const ranges = parseIpWhitelist(entries, name);

  if (ranges.length === 0) {
    // Nothing to restrict, so we simply pass all requests through
    return (req: Request, res: Response, next: NextFunction) => next();
  }

  logger.info(
    `Restricting access via ${name} to: ${ranges
      .map(([address, bits]) => `${address.toString()}/${bits}`)
      .join(", ")}`,
  );

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getRequestIp(req);
    if (isIpWhitelisted(ip, ranges)) {
      next();
      return;
    }

    logger.debug(
      `Ignoring request from non-whitelisted IP (${ip}): ${req.method} ${req.originalUrl}`,
    );
    // Silently drop the connection, without responding to the request
    req.socket.destroy();
  };
}

// Applies to all endpoints
const publicIpWhitelistMiddleware = createIpWhitelistMiddleware(
  config.ipWhitelist.public,
  "PUBLIC_IP_WHITELIST",
);
// Applies to private endpoints only i.e. the Admin UI and the API endpoints
// requiring an API key
const privateIpWhitelistMiddleware = createIpWhitelistMiddleware(
  config.ipWhitelist.private,
  "PRIVATE_IP_WHITELIST",
);

export {
  createIpWhitelistMiddleware,
  isIpWhitelisted,
  parseIpWhitelist,
  privateIpWhitelistMiddleware,
  publicIpWhitelistMiddleware,
};
