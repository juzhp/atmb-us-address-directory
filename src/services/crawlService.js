import PQueue from "p-queue";
import got from "got";
import { crawlUsaLocations, scanLocationPersonalizeRange } from "../crawler/anytimeMailbox.js";
import { config } from "../config.js";
import {
  applySmartyTokenUsage,
  createJob,
  getLatestJob,
  getLatestJobByType,
  listAvailableSmartyTokens,
  listLocationsForPersonalizeScan,
  listLocationsForSmartyEnrichment,
  markSmartyTokenError,
  markMissingLocationsInactive,
  nowIso,
  updateLocationSmartyEnrichment,
  updateLocationPersonalizeScan,
  updateJob,
  upsertLocation
} from "../db.js";

const activeRuns = new Map();
const smartyClient = got.extend({
  timeout: { request: config.requestTimeoutMs },
  retry: { limit: 0 },
  headers: {
    "content-type": "application/json",
    "user-agent": config.userAgent
  }
});

export function getCrawlStatus() {
  return {
    isRunning: activeRuns.size > 0,
    job: getLatestJob()
  };
}

export function startCrawl() {
  if (activeRuns.has("locations")) {
    return { started: false, reason: "A crawl job is already running.", job: getLatestJob() };
  }

  const jobId = createJob("locations");
  const job = {
    id: jobId,
    type: "locations",
    status: "running",
    startedAt: nowIso(),
    finishedAt: null,
    totalStates: 0,
    totalDiscovered: 0,
    totalProcessed: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalFailed: 0,
    error: null
  };

  const run = runCrawl(job)
    .catch((error) => {
      job.status = "failed";
      job.finishedAt = nowIso();
      job.error = error.message;
      updateJob(job);
    })
    .finally(() => {
      activeRuns.delete("locations");
    });

  activeRuns.set("locations", run);
  return { started: true, job: getLatestJob() };
}

export function startPersonalizeScan(filters = {}) {
  if (activeRuns.has("personalize")) {
    return {
      started: false,
      reason: "A personalize scan job is already running.",
      job: getLatestJobByType("personalize")
    };
  }

  const jobId = createJob("personalize");
  const job = {
    id: jobId,
    type: "personalize",
    status: "running",
    startedAt: nowIso(),
    finishedAt: null,
    totalStates: 0,
    totalDiscovered: 0,
    totalProcessed: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalFailed: 0,
    error: null
  };

  const run = runPersonalizeScan(job, filters)
    .catch((error) => {
      job.status = "failed";
      job.finishedAt = nowIso();
      job.error = error.message;
      updateJob(job);
    })
    .finally(() => {
      activeRuns.delete("personalize");
    });

  activeRuns.set("personalize", run);
  return { started: true, job: getLatestJobByType("personalize") };
}

export function startSmartyEnrichment(filters = {}) {
  if (activeRuns.has("smarty")) {
    return {
      started: false,
      reason: "A Smarty enrichment job is already running.",
      job: getLatestJobByType("smarty")
    };
  }

  const jobId = createJob("smarty");
  const job = {
    id: jobId,
    type: "smarty",
    status: "running",
    startedAt: nowIso(),
    finishedAt: null,
    totalStates: 0,
    totalDiscovered: 0,
    totalProcessed: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalFailed: 0,
    error: null
  };

  const run = runSmartyEnrichment(job, filters)
    .catch((error) => {
      job.status = "failed";
      job.finishedAt = nowIso();
      job.error = error.message;
      updateJob(job);
    })
    .finally(() => {
      activeRuns.delete("smarty");
    });

  activeRuns.set("smarty", run);
  return { started: true, job: getLatestJobByType("smarty") };
}

async function runCrawl(job) {
  const seenExternalIds = [];

  const result = await crawlUsaLocations({
    onProgress: (progress) => {
      if (progress.type === "state_complete") {
        job.totalStates = progress.totalStates;
        job.totalProcessed = progress.processedStates;
        job.totalDiscovered = progress.discovered;
        job.totalFailed = progress.failed;
        updateJob(job);
      }
    }
  });

  job.totalStates = result.totalStates;
  job.totalDiscovered = result.locations.length;

  for (const location of result.locations) {
    const outcome = upsertLocation(location);
    job.totalInserted += outcome.inserted;
    job.totalUpdated += outcome.updated;
    seenExternalIds.push(location.externalId);
  }

  if (seenExternalIds.length > 0) {
    markMissingLocationsInactive(seenExternalIds);
  }

  job.status = "success";
  job.finishedAt = nowIso();
  updateJob(job);
}

async function runPersonalizeScan(job, filters) {
  const locations = listLocationsForPersonalizeScan(filters);
  const queue = new PQueue({ concurrency: Math.min(config.concurrency, 3) });

  job.totalDiscovered = locations.length;
  updateJob(job);

  const tasks = locations.map((location) =>
    queue.add(async () => {
      try {
        const result = await scanLocationPersonalizeRange(location.detail_url);
        updateLocationPersonalizeScan(location.id, result);

        const hasRange =
          Number.isFinite(result.personalizeMin) && Number.isFinite(result.personalizeMax);

        if (hasRange && !result.personalizeError) {
          job.totalUpdated += 1;
        } else {
          job.totalFailed += 1;
        }
      } catch (error) {
        updateLocationPersonalizeScan(location.id, {
          firstPlanUrl: null,
          firstPlanTerm: null,
          firstPlanSrvplId: null,
          personalizeMin: null,
          personalizeMax: null,
          personalizeScannedAt: nowIso(),
          personalizeError: error.message
        });
        job.totalFailed += 1;
      } finally {
        job.totalProcessed += 1;
        updateJob(job);
      }
    })
  );

  await Promise.all(tasks);

  if (job.totalFailed > 0 && job.totalUpdated === 0) {
    job.status = "failed";
    job.error = `Personalize scan failed for all ${job.totalFailed} locations. Check personalize_error and server logs.`;
  } else {
    job.status = "success";
    if (job.totalFailed > 0) {
      job.error = `Personalize scan completed with ${job.totalFailed} failed locations. Check personalize_error for details.`;
    }
  }
  job.finishedAt = nowIso();
  updateJob(job);
}

async function runSmartyEnrichment(job, filters) {
  const locations = listLocationsForSmartyEnrichment(filters);
  let queue = [...locations];

  job.totalDiscovered = queue.length;
  updateJob(job);

  while (queue.length > 0) {
    const tokens = listAvailableSmartyTokens();
    const token = tokens[0];

    if (!token) {
      throw new Error("No active Smarty token with remaining quota.");
    }

    const remainingQuota = Math.max(0, token.quotaLimit - token.quotaUsed);
    const batchSize = Math.min(100, remainingQuota, queue.length);

    if (batchSize <= 0) {
      markSmartyTokenError(token.id, "Local quota exhausted.", "exhausted");
      continue;
    }

    const batch = queue.slice(0, batchSize);

    try {
      const results = await callSmartyBatch(token, batch);
      const resultMap = new Map(
        results.map((result) => [String(result.input_id ?? result.input_index), result])
      );

      for (const location of batch) {
        const candidate = resultMap.get(String(location.id));
        if (!candidate) {
          updateLocationSmartyEnrichment(location.id, {
            rdi: null,
            cmra: null,
            smartyScannedAt: nowIso(),
            smartyError: "No candidate returned."
          });
          job.totalFailed += 1;
          continue;
        }

        updateLocationSmartyEnrichment(location.id, {
          rdi: normalizeSmartyRdi(candidate.metadata?.rdi),
          cmra: normalizeSmartyCmra(candidate.analysis?.dpv_cmra),
          smartyScannedAt: nowIso(),
          smartyError: null
        });
        job.totalUpdated += 1;
      }

      applySmartyTokenUsage(token.id, batch.length, null);
      job.totalProcessed += batch.length;
      queue = queue.slice(batch.length);
      updateJob(job);
    } catch (error) {
      const statusCode = error.response?.statusCode;

      if (statusCode === 401 || statusCode === 403) {
        markSmartyTokenError(token.id, error.message, "error");
        continue;
      }

      if (statusCode === 402 || statusCode === 429) {
        markSmartyTokenError(token.id, error.message, "exhausted");
        continue;
      }

      for (const location of batch) {
        updateLocationSmartyEnrichment(location.id, {
          rdi: location.rdi || null,
          cmra: location.cmra || null,
          smartyScannedAt: nowIso(),
          smartyError: error.message
        });
      }

      job.totalProcessed += batch.length;
      job.totalFailed += batch.length;
      queue = queue.slice(batch.length);
      updateJob(job);
    }
  }

  job.status = "success";
  job.finishedAt = nowIso();
  updateJob(job);
}

async function callSmartyBatch(token, batch) {
  const searchParams = new URLSearchParams({
    "auth-id": token.authId,
    "auth-token": token.authToken,
    candidates: "1"
  });

  const body = batch.map((location) => ({
    input_id: String(location.id),
    street: location.street,
    street2: location.street2 || undefined,
    city: location.city,
    state: location.state,
    zipcode: location.postal_code
  }));

  return smartyClient
    .post(`${config.smartyApiBaseUrl}?${searchParams.toString()}`, {
      json: body
    })
    .json();
}

function normalizeSmartyRdi(value) {
  if (value === "Residential" || value === "Commercial") {
    return value;
  }

  return null;
}

function normalizeSmartyCmra(value) {
  if (value === "Y" || value === "N") {
    return value;
  }

  return null;
}
