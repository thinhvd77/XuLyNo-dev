import { useState, useEffect, useCallback } from 'react';
import { API_ENDPOINTS } from '../config/api';

const useCaseTimeline = (caseId) => {
  const [timeline, setTimeline] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    total: 0,
    limit: 5,
    hasMore: false,
  });

  // Fetch timeline data
  const fetchTimeline = useCallback(
    async (page = 1, reset = false, type = 'all') => {
      const token = localStorage.getItem('token');
      if (!token || !caseId) return;

      try {
        if (reset) {
          setIsLoading(true);
          setTimeline([]);
        } else {
          setIsLoadingMore(true);
        }

        setError(null);

        const response = await fetch(
          `${API_ENDPOINTS.CASES.CASE_TIMELINE(caseId)}?page=${page}&limit=5&type=${type}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          const newTimeline = data.data || [];
          const newPagination = data.pagination || {};

          if (reset) {
            setTimeline(newTimeline);
          } else {
            setTimeline((prev) => [...prev, ...newTimeline]);
          }

          setPagination(newPagination);
        } else {
          throw new Error(data.message || 'Failed to fetch timeline');
        }
      } catch (err) {
        console.error('Error fetching timeline:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [caseId],
  );

  // Load more timeline items
  const loadMore = useCallback(() => {
    if (!isLoadingMore && pagination.hasMore) {
      fetchTimeline(pagination.currentPage + 1, false);
    }
  }, [fetchTimeline, isLoadingMore, pagination.hasMore, pagination.currentPage]);

  // Refresh timeline
  const refresh = useCallback(
    (type = 'all') => {
      fetchTimeline(1, true, type);
    },
    [fetchTimeline],
  );

  // Add new timeline item (optimistic update)
  const addTimelineItem = useCallback((newItem) => {
    setTimeline((prev) => [newItem, ...prev]);
    setPagination((prev) => ({
      ...prev,
      total: prev.total + 1,
    }));
  }, []);

  // Initial load
  useEffect(() => {
    if (caseId) {
      fetchTimeline(1, true);
    }
  }, [caseId, fetchTimeline]);

  return {
    timeline,
    isLoading,
    isLoadingMore,
    error,
    pagination,
    loadMore,
    refresh,
    addTimelineItem,
  };
};

export default useCaseTimeline;
