import { useLanguage } from "./useLanguage";

export function useT() {
  return useLanguage().t;
}
