export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; backoffMs: number },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.retries) break;
      await new Promise((resolve) => setTimeout(resolve, options.backoffMs * (attempt + 1)));
    }
  }
  throw lastError;
}
