const stores = {
  expenses: new Map(),
  categories: new Map(),
  earnings: new Map(),
};

export function getCached(store, userId) {
  if (!userId) {
    return null;
  }

  return stores[store].get(userId) ?? null;
}

export function setCached(store, userId, data) {
  if (!userId) {
    return;
  }

  stores[store].set(userId, data);
}

export function invalidateCached(store, userId) {
  if (!userId) {
    return;
  }

  stores[store].delete(userId);
}
