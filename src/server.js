import fs from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import { z } from "zod";
import {
  changeUserPassword,
  ensureDefaultAdmin,
  getExpiredSessionCookieHeader,
  getSessionCookieHeader,
  loginUser,
  logoutUser,
  resolveUserFromCookie
} from "./auth.js";
import { config } from "./config.js";
import {
  authenticateApiKey,
  createApiKey,
  deleteApiKey,
  createSmartyToken,
  getApiKeyById,
  getLocationById,
  getLocationStats,
  listOpenLocations,
  getSiteSettings,
  getSmartyTokenById,
  listApiKeys,
  listRecentStatesFromLatestLocations,
  listStates,
  listLocations,
  listSmartyTokens,
  patchLocation,
  resetSmartyTokenUsage,
  updateSiteSettings,
  updateSmartyToken
} from "./db.js";
import {
  getCrawlStatus,
  startCrawl,
  startPersonalizeScan,
  startSmartyEnrichment
} from "./services/crawlService.js";

const patchSchema = z.object({
  locationName: z.string().min(1).optional(),
  fullAddress: z.string().min(1).optional(),
  street: z.string().min(1).optional(),
  street2: z.union([z.string().min(1), z.literal(""), z.null()]).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  monthlyPrice: z.union([z.number(), z.null()]).optional(),
  detailUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  firstPlanUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  firstPlanTerm: z.union([z.number().int().nonnegative(), z.null()]).optional(),
  firstPlanSrvplId: z.union([z.number().int().nonnegative(), z.null()]).optional(),
  personalizeMin: z.union([z.number().int().nonnegative(), z.null()]).optional(),
  personalizeMax: z.union([z.number().int().nonnegative(), z.null()]).optional(),
  rdi: z.union([z.enum(["Residential", "Commercial"]), z.literal(""), z.null()]).optional(),
  cmra: z.union([z.enum(["Y", "N"]), z.literal(""), z.null()]).optional(),
  isActive: z.boolean().optional()
});
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  nextPassword: z.string().min(6)
});
const personalizeScanSchema = z.object({
  query: z.string().optional(),
  state: z.string().optional(),
  isActive: z.union([z.string(), z.number()]).optional(),
  rdi: z.union([z.enum(["Residential", "Commercial"]), z.literal("")]).optional(),
  cmra: z.union([z.enum(["Y", "N"]), z.literal("")]).optional()
});
const smartyTokenCreateSchema = z.object({
  name: z.string().min(1),
  authId: z.string().min(1),
  authToken: z.string().min(1),
  quotaLimit: z.number().int().nonnegative(),
  priority: z.number().int().nonnegative().optional(),
  status: z.enum(["active", "disabled", "exhausted", "error"]).optional()
});
const smartyTokenUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  authId: z.string().min(1).optional(),
  authToken: z.string().min(1).optional(),
  quotaLimit: z.number().int().nonnegative().optional(),
  priority: z.number().int().nonnegative().optional(),
  status: z.enum(["active", "disabled", "exhausted", "error"]).optional()
});
const siteSettingsSchema = z.object({
  headCode: z.string().optional()
});
const apiKeyCreateSchema = z.object({
  name: z.string().min(1)
});
const publicDir = path.join(process.cwd(), "public");

export function buildServer() {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : {
              target: "pino-pretty"
            }
    }
  });

  app.decorateRequest("auth", null);
  app.decorateRequest("apiKey", null);

  app.addHook("onRequest", async (request) => {
    request.auth = resolveUserFromCookie(request.headers.cookie);
    request.apiKey = null;
  });

  app.get("/health", async () => ({
    ok: true
  }));

  app.get("/api/auth/me", async (request, reply) => {
    if (!request.auth?.user) {
      return reply.code(401).send({ message: "Authentication required." });
    }

    return { user: request.auth.user };
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid login payload.",
        issues: parsed.error.flatten()
      });
    }

    const session = await loginUser(parsed.data.username, parsed.data.password);
    if (!session) {
      return reply.code(401).send({ message: "Invalid username or password." });
    }

    reply.header("Set-Cookie", getSessionCookieHeader(session.cookieValue, session.expiresAt));
    return {
      user: session.user
    };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    logoutUser(request.auth?.token);
    reply.header("Set-Cookie", getExpiredSessionCookieHeader());
    return { ok: true };
  });

  app.post("/api/auth/password", async (request, reply) => {
    if (!request.auth?.user) {
      return reply.code(401).send({ message: "Authentication required." });
    }

    const parsed = changePasswordSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid password payload.",
        issues: parsed.error.flatten()
      });
    }

    const result = await changeUserPassword(
      request.auth.user.id,
      parsed.data.currentPassword,
      parsed.data.nextPassword
    );

    if (!result.ok) {
      return reply.code(400).send({ message: result.reason });
    }

    return { ok: true, user: result.user };
  });

  app.get("/api/public/stats", async () => {
    return getLocationStats();
  });

  app.get("/api/public/states", async () => listStates());

  app.get("/api/public/recent-states", async (request) => {
    const query = request.query ?? {};
    return listRecentStatesFromLatestLocations(query.limit);
  });

  app.get("/api/public/locations", async (request) => {
    const query = request.query ?? {};
    return listLocations({
      page: query.page,
      limit: query.limit ?? 24,
      state: query.state,
      rdi: query.rdi,
      cmra: query.cmra,
      isActive: 1,
      query: query.q,
      sort: "first_seen_desc"
    });
  });

  app.get("/api/public/locations/:id", async (request, reply) => {
    const record = getLocationById(Number(request.params.id));
    if (!record || !record.isActive) {
      return reply.code(404).send({ message: "Location not found." });
    }

    return record;
  });

  app.get("/api/public/settings", async () => getSiteSettings());

  app.get("/api/open/locations", { preHandler: requireApiKey }, async (request, reply) => {
    const query = request.query ?? {};
    const residentialOnly = ["1", "true", "yes"].includes(
      String(query.residential ?? "")
        .trim()
        .toLowerCase()
    );
    const ids = parseIdsQuery(query.ids);

    if (!residentialOnly && ids.length === 0) {
      return reply.code(400).send({
        message: "Provide residential=1 or ids=1,2,3."
      });
    }

    return {
      items: listOpenLocations({
        residentialOnly,
        ids
      })
    };
  });

  app.get("/api/open/locations/residential", { preHandler: requireApiKey }, async () => ({
    items: listOpenLocations({ residentialOnly: true })
  }));

  app.patch("/api/open/locations/:id", { preHandler: requireApiKey }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ message: "Invalid location id." });
    }

    const parsed = patchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid payload.",
        issues: parsed.error.flatten()
      });
    }

    const existing = getLocationById(id);
    if (!existing) {
      return reply.code(404).send({ message: "Location not found." });
    }

    return patchLocation(id, normalizeLocationPatch(parsed.data));
  });

  app.get("/", async (_request, reply) => {
    const html = await fs.readFile(path.join(publicDir, "admin.html"), "utf8");
    reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/admin", { preHandler: requireAdmin }, async (_request, reply) => {
    const html = await fs.readFile(path.join(publicDir, "admin.html"), "utf8");
    reply.type("text/html; charset=utf-8").send(html);
  });

  app.get("/assets/:filename", async (request, reply) => {
    const fileName = String(request.params.filename || "");
    if (!["admin.css", "admin.js"].includes(fileName)) {
      return reply.code(404).send({ message: "Asset not found." });
    }

    const filePath = path.join(publicDir, fileName);
    const file = await fs.readFile(filePath, "utf8");
    const contentType = fileName.endsWith(".css")
      ? "text/css; charset=utf-8"
      : "application/javascript; charset=utf-8";

    return reply.type(contentType).send(file);
  });

  app.get("/admin/crawl/status", { preHandler: requireAdmin }, async () => getCrawlStatus());

  app.get(
    "/api/admin/crawl/status",
    { preHandler: requireAdmin },
    async () => getCrawlStatus()
  );

  app.post("/admin/crawl/start", { preHandler: requireAdmin }, async (_, reply) => {
    const result = startCrawl();

    if (!result.started) {
      return reply.code(409).send(result);
    }

    return reply.code(202).send(result);
  });

  app.post("/api/admin/crawl/start", { preHandler: requireAdmin }, async (_, reply) => {
    const result = startCrawl();

    if (!result.started) {
      return reply.code(409).send(result);
    }

    return reply.code(202).send(result);
  });

  app.post("/admin/crawl/personalize/start", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = personalizeScanSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid personalize scan payload.",
        issues: parsed.error.flatten()
      });
    }

    const result = startPersonalizeScan(parsed.data);

    if (!result.started) {
      return reply.code(409).send(result);
    }

    return reply.code(202).send(result);
  });

  app.post(
    "/api/admin/crawl/personalize/start",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = personalizeScanSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid personalize scan payload.",
          issues: parsed.error.flatten()
        });
      }

      const result = startPersonalizeScan(parsed.data);

      if (!result.started) {
        return reply.code(409).send(result);
      }

      return reply.code(202).send(result);
    }
  );

  app.post("/admin/crawl/smarty/start", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = personalizeScanSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid Smarty enrichment payload.",
        issues: parsed.error.flatten()
      });
    }

    const result = startSmartyEnrichment(parsed.data);

    if (!result.started) {
      return reply.code(409).send(result);
    }

    return reply.code(202).send(result);
  });

  app.post(
    "/api/admin/crawl/smarty/start",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = personalizeScanSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid Smarty enrichment payload.",
          issues: parsed.error.flatten()
        });
      }

      const result = startSmartyEnrichment(parsed.data);

      if (!result.started) {
        return reply.code(409).send(result);
      }

      return reply.code(202).send(result);
    }
  );

  app.get("/admin/locations", { preHandler: requireAdmin }, async (request) => {
    const query = request.query ?? {};
    return listLocations({
      page: query.page,
      limit: query.limit,
      state: query.state,
      rdi: query.rdi,
      cmra: query.cmra,
      isActive: query.isActive,
      query: query.q
    });
  });

  app.get("/api/admin/locations", { preHandler: requireAdmin }, async (request) => {
    const query = request.query ?? {};
    return listLocations({
      page: query.page,
      limit: query.limit,
      state: query.state,
      rdi: query.rdi,
      cmra: query.cmra,
      isActive: query.isActive,
      query: query.q
    });
  });

  app.get("/admin/locations/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const record = getLocationById(Number(request.params.id));
    if (!record) {
      return reply.code(404).send({ message: "Location not found." });
    }

    return record;
  });

  app.get("/api/admin/locations/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const record = getLocationById(Number(request.params.id));
    if (!record) {
      return reply.code(404).send({ message: "Location not found." });
    }

    return record;
  });

  app.patch("/admin/locations/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ message: "Invalid location id." });
    }

    const parsed = patchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid payload.",
        issues: parsed.error.flatten()
      });
    }

    const existing = getLocationById(id);
    if (!existing) {
      return reply.code(404).send({ message: "Location not found." });
    }

    return patchLocation(id, parsed.data);
  });

  app.patch(
    "/api/admin/locations/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({ message: "Invalid location id." });
      }

      const parsed = patchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid payload.",
          issues: parsed.error.flatten()
        });
      }

      const existing = getLocationById(id);
      if (!existing) {
        return reply.code(404).send({ message: "Location not found." });
      }

      return patchLocation(id, parsed.data);
    }
  );

  app.get("/admin/smarty/tokens", { preHandler: requireAdmin }, async () => listSmartyTokens());

  app.get("/api/admin/smarty/tokens", { preHandler: requireAdmin }, async () =>
    listSmartyTokens()
  );

  app.get("/api/admin/settings", { preHandler: requireAdmin }, async () => getSiteSettings());

  app.put("/api/admin/settings", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = siteSettingsSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid site settings payload.",
        issues: parsed.error.flatten()
      });
    }

    return updateSiteSettings(parsed.data);
  });

  app.get("/api/admin/api-keys", { preHandler: requireAdmin }, async () => listApiKeys());

  app.post("/api/admin/api-keys", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = apiKeyCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid API key payload.",
        issues: parsed.error.flatten()
      });
    }

    return reply.code(201).send(createApiKey(parsed.data.name.trim()));
  });

  app.delete("/api/admin/api-keys/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ message: "Invalid API key id." });
    }

    const existing = getApiKeyById(id);
    if (!existing) {
      return reply.code(404).send({ message: "API key not found." });
    }

    deleteApiKey(id);
    return { ok: true };
  });

  app.post("/admin/smarty/tokens", { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = smartyTokenCreateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid Smarty token payload.",
        issues: parsed.error.flatten()
      });
    }

    return reply.code(201).send(createSmartyToken(parsed.data));
  });

  app.post(
    "/api/admin/smarty/tokens",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const parsed = smartyTokenCreateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid Smarty token payload.",
          issues: parsed.error.flatten()
        });
      }

      return reply.code(201).send(createSmartyToken(parsed.data));
    }
  );

  app.patch("/admin/smarty/tokens/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ message: "Invalid token id." });
    }

    const parsed = smartyTokenUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Invalid Smarty token update payload.",
        issues: parsed.error.flatten()
      });
    }

    const updated = updateSmartyToken(id, parsed.data);
    if (!updated) {
      return reply.code(404).send({ message: "Smarty token not found." });
    }

    return updated;
  });

  app.patch(
    "/api/admin/smarty/tokens/:id",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({ message: "Invalid token id." });
      }

      const parsed = smartyTokenUpdateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Invalid Smarty token update payload.",
          issues: parsed.error.flatten()
        });
      }

      const updated = updateSmartyToken(id, parsed.data);
      if (!updated) {
        return reply.code(404).send({ message: "Smarty token not found." });
      }

      return updated;
    }
  );

  app.post("/admin/smarty/tokens/:id/reset-usage", { preHandler: requireAdmin }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ message: "Invalid token id." });
    }

    const token = getSmartyTokenById(id);
    if (!token) {
      return reply.code(404).send({ message: "Smarty token not found." });
    }

    return resetSmartyTokenUsage(id);
  });

  app.post(
    "/api/admin/smarty/tokens/:id/reset-usage",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return reply.code(400).send({ message: "Invalid token id." });
      }

      const token = getSmartyTokenById(id);
      if (!token) {
        return reply.code(404).send({ message: "Smarty token not found." });
      }

      return resetSmartyTokenUsage(id);
    }
  );

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.code(500).send({
      message: "Internal server error."
    });
  });

  return app;
}

export async function startServer() {
  await ensureDefaultAdmin();
  const app = buildServer();
  await app.listen({
    port: config.port,
    host: config.host
  });
  return app;
}

async function requireAdmin(request, reply) {
  if (!request.auth?.user || request.auth.user.role !== "admin") {
    return reply.code(401).send({ message: "Authentication required." });
  }
}

async function requireApiKey(request, reply) {
  const headerValue = request.headers["x-api-key"];
  const bearer = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice(7)
    : null;
  const keyValue = Array.isArray(headerValue) ? headerValue[0] : headerValue || bearer;
  const apiKey = authenticateApiKey(keyValue);

  if (!apiKey) {
    return reply.code(401).send({ message: "Invalid API key." });
  }

  request.apiKey = apiKey;
}

function normalizeLocationPatch(input) {
  return {
    ...input,
    street2: input.street2 === "" ? null : input.street2,
    detailUrl: input.detailUrl === "" ? null : input.detailUrl,
    firstPlanUrl: input.firstPlanUrl === "" ? null : input.firstPlanUrl,
    rdi: input.rdi === "" ? null : input.rdi,
    cmra: input.cmra === "" ? null : input.cmra
  };
}

function parseIdsQuery(value) {
  if (!value) {
    return [];
  }

  const raw = Array.isArray(value) ? value.join(",") : String(value);
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}
