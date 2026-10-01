import { useEffect, useState } from "react";
import {
  deleteCategoryBudget,
  fetchCategoryBudgets,
  upsertCategoryBudget,
} from "../services/categoryBudgetsService";
import { getCached, setCached } from "../utils/dataCache";

const CACHE_KEY = "categoryBudgets";

export function useCategoryBudgets(userId) {
  const initialCache = userId ? getCached(CACHE_KEY, userId) : null;
  const [budgets, setBudgetsState] = useState(initialCache ?? []);
  const [loading, setLoading] = useState(Boolean(userId) && !initialCache);

  useEffect(() => {
    if (!userId) {
      setBudgetsState([]);
      setLoading(false);
      return undefined;
    }

    const cached = getCached(CACHE_KEY, userId);
    if (cached) {
      setBudgetsState(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let active = true;

    fetchCategoryBudgets(userId)
      .then((data) => {
        if (active) {
          setBudgetsState(data);
          setCached(CACHE_KEY, userId, data);
        }
      })
      .catch((err) => {
        console.error("Failed to load category budgets:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const setBudgets = (updater) => {
    setBudgetsState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (userId) {
        setCached(CACHE_KEY, userId, next);
      }
      return next;
    });
  };

  const saveBudget = async (categoryId, amount) => {
    const saved = await upsertCategoryBudget(userId, categoryId, amount);
    setBudgets((prev) => {
      const without = prev.filter((item) => item.categoryId !== categoryId);
      return [...without, saved];
    });
    return saved;
  };

  const removeBudget = async (categoryId) => {
    await deleteCategoryBudget(userId, categoryId);
    setBudgets((prev) => prev.filter((item) => item.categoryId !== categoryId));
  };

  return { budgets, loading, setBudgets, saveBudget, removeBudget };
}
