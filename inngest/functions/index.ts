import { generateAsset } from "./generateAsset";
import {
  buildDownloadZipFn,
  dataExportFn,
  expireCreditsFn,
  providerWebhookRelay,
  resetViolationCountersFn,
  retentionCleanupFn,
  sendEmailFn,
} from "./maintenance";

export const functions = [
  generateAsset,
  providerWebhookRelay,
  buildDownloadZipFn,
  retentionCleanupFn,
  expireCreditsFn,
  resetViolationCountersFn,
  sendEmailFn,
  dataExportFn,
];
