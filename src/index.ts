import "./instrumentation";

import { openTelemetryPlugin } from "@loglayer/plugin-opentelemetry";
import { OpenTelemetryTransport } from "@loglayer/transport-opentelemetry";
import { PinoTransport } from "@loglayer/transport-pino";
import { Hono } from "hono";
import { LogLayer } from "loglayer";
import pino from "pino";
import { serializeError } from "serialize-error";
import { GdoService } from "./services/gdo/service";
import { WardrobeWarsService } from "./services/wardrobewars/service";

const app = new Hono();

// Strip trailing slashes silently without HTTP redirect
app.use(async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname.endsWith("/") && url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
    c.req.raw = new Request(url.toString(), c.req.raw);
  }
  await next();
});

const services = [new GdoService(), new WardrobeWarsService()];

// Logging
export const log = new LogLayer({
  transport: [
    new PinoTransport({
      logger: pino({
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
    }),
    new OpenTelemetryTransport(),
  ],
  plugins: [openTelemetryPlugin()],
  serializers: { error: serializeError },
});

// Register routes
for (const service of services) {
  log.info(`Registering service: ${service.name} — ${service.description}`);
  service.registerRoutes(app);
}

// Destinations LIST passthrough (was the 404 fallback).
//
// destinations.destinationhome.live is a SHARED host: besides the services
// registered above, it is what the Core Spaces travel/teleport menu talks to.
// The previous destinations-api deliberately answered 200 for everything it did
// not implement, so an unhandled destinations-list call degraded quietly
// instead of 404ing the menu. This restores that behaviour.
//
// Implemented as notFound rather than app.all("*") on purpose: notFound only
// runs when no route matched at all, so it can never shadow a registered route.
// Set DESTINATIONS_STRICT_404=1 to get real 404s back while debugging.
const STRICT_404 = ["1", "true", "on"].includes(
  String(process.env.DESTINATIONS_STRICT_404 ?? "").toLowerCase(),
);

app.notFound((c) => {
  if (STRICT_404) {
    log.warn(`[404] ${c.req.method} ${c.req.path}`);
    return c.text("Not Found", 404);
  }
  log.debug(`[destinations-list] passthrough ${c.req.method} ${c.req.path}`);
  return c.text("OK", 200);
});

// Error handler
app.onError((err, c) => {
  log.error(err, `[500] ${c.req.method} ${c.req.path}`);
  return c.text("Internal Server Error", 500);
});

const port = Number(process.env.PORT) || 3000;
log.info(`psh-destinations listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
