import { useEffect, useState } from "react";
import { fetchCategories } from "../services/categoriesService";

export function useCategories(userId) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    let active = true;

    fetchCategories(userId)
      .then((data) => {
        if (active) {
          setCategories(data);
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

  return { categories, loading, setCategories };
}
