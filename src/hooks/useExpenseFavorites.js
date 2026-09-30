import { useCallback, useEffect, useState } from "react";
import {
  createExpenseFavorite,
  deleteExpenseFavorite,
  fetchExpenseFavorites,
} from "../services/expenseFavoritesService";

export function useExpenseFavorites(userId) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    fetchExpenseFavorites(userId)
      .then((data) => {
        if (active) setFavorites(data);
      })
      .catch((err) => {
        console.error("Failed to load favorites:", err);
        if (active) setFavorites([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const addFavorite = useCallback(
    async (favorite) => {
      if (!userId) throw new Error("Not signed in.");
      const created = await createExpenseFavorite(userId, favorite);
      setFavorites((prev) => [created, ...prev]);
      return created;
    },
    [userId]
  );

  const removeFavorite = useCallback(
    async (favoriteId) => {
      if (!userId) throw new Error("Not signed in.");
      await deleteExpenseFavorite(userId, favoriteId);
      setFavorites((prev) => prev.filter((item) => item.id !== favoriteId));
    },
    [userId]
  );

  return { favorites, loading, addFavorite, removeFavorite, setFavorites };
}
