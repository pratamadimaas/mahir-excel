import { useEffect } from 'react';

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} | Mahir Excel`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
