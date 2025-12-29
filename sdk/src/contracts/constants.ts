import { LRUCache } from "lru-cache";

export const storeBalanceCache = new LRUCache<string, bigint>({
  max: 1000,
  ttl: 1000 * 60 * 10, // 10 minutes
  updateAgeOnGet: true,
});

export function makeStoreCacheKey(
  merchant: string,
  store: string,
  token: string
): string {
  return `${merchant.toLowerCase()}_${store.toLowerCase()}_${token.toLowerCase()}`;
}
