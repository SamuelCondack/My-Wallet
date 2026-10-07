import { useEffect, useRef, useState } from "react";

/**
 * Shared search text for page + floating dock fields.
 * Inputs stay uncontrolled while focused so iOS Safari does not shove the
 * caret away from the last typed character on every controlled re-render.
 */
export default function useSharedSearchFields() {
  const [searchQuery, setSearchQuery] = useState("");
  const pageInputRef = useRef(null);
  const dockInputRef = useRef(null);

  const syncDomValue = (value, { skip } = {}) => {
    if (pageInputRef.current && skip !== pageInputRef.current) {
      pageInputRef.current.value = value;
    }
    if (dockInputRef.current && skip !== dockInputRef.current) {
      dockInputRef.current.value = value;
    }
  };

  useEffect(() => {
    syncDomValue(searchQuery, { skip: document.activeElement });
  }, [searchQuery]);

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);
    syncDomValue(value, { skip: event.target });
  };

  const clearSearchQuery = () => {
    setSearchQuery("");
    syncDomValue("");
  };

  return {
    searchQuery,
    setSearchQuery,
    pageInputRef,
    dockInputRef,
    handleSearchChange,
    clearSearchQuery,
  };
}
