import { isCogneeConfigured, env } from '../../config/env';
import { searchCognee } from './cognee.client';

/** Store a compact, non-sensitive resolution summary in Cognee when configured.
 * If Cognee is unavailable the application remains operational and records the
 * outcome in MongoDB instead; credentials are never sent to the browser.
 */
export async function rememberResolution(input: {
  caseId: string;
  issue: string;
  action: string;
  result: string;
  merchantId?: string;
}): Promise<'COGNEE' | 'LOCAL_FALLBACK'> {
  if (!isCogneeConfigured()) return 'LOCAL_FALLBACK';
  const base = env.cogneeApiUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base}/api/v1/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.cogneeApiKey}` },
      body: JSON.stringify({ dataset: env.cogneeDataset, data: [{
        id: `resolution-${input.caseId}`,
        text: `Resolved case ${input.caseId}. Issue: ${input.issue}. Action: ${input.action}. Verified outcome: ${input.result}. Merchant: ${input.merchantId ?? 'unknown'}.`,
        metadata: { type: 'resolved_case', caseId: input.caseId, merchantId: input.merchantId ?? '' },
      }] }),
      signal: controller.signal,
    });
    if (!response.ok) return 'LOCAL_FALLBACK';
    return 'COGNEE';
  } catch { return 'LOCAL_FALLBACK'; }
  finally { clearTimeout(timer); }
}

export async function findSimilarCases(query: string) {
  try { return await searchCognee(`${query} historical resolved cases`, 5); }
  catch { return []; }
}
