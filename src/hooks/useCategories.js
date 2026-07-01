import { useEffect, useState } from "react";
import { fetchCategories } from "../services/categoriesService";
import { getCached, setCached } from "../utils/dataCache";

export function useCategories(userId) {
  const initialCache = userId ? getCached("categories", userId) : null;
  const [categories, setCategoriesState] = useState(initialCache ?? []);
  const [loading, setLoading] = useState(Boolean(userId) && !initialCache);

  useEffect(() => {
    if (!userId) {
      setCategoriesState([]);
      setLoading(false);
      return;
    }

    const cached = getCached("categories", userId);
    if (cached) {
      setCategoriesState(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let active = true;

    fetchCategories(userId)
      .then((data) => {
        if (active) {
          setCategoriesState(data);
          setCached("categories", userId, data);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const setCategories = (updater) => {
    setCategoriesState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (userId) {
        setCached("categories", userId, next);
      }
      return next;
    });
  };

  return { categories, loading, setCategories };
}
