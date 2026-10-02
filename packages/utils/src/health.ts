export async function healthCheck(
  checks: Record<string, () => Promise<boolean>>,
): Promise<{ ok: boolean; checks: Record<string, boolean> }> {
  const results: Record<string, boolean> = {};
  await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      try {
        results[name] = await check();
      } catch {
        results[name] = false;
      }
    }),
  );
  return { ok: Object.values(results).every(Boolean), checks: results };
}
