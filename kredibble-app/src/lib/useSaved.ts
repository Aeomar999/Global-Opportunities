import { useEffect, useState, useCallback } from 'react';
import { profileStore } from '../constants/mockProfile';
import { useToast } from '../components/ui/ToastProvider';

type SavedType = 'jobs' | 'internships' | 'events' | 'grants';

/** Bookmark state for one item, shared with the saved list through profileStore. */
export function useSaved(id: string | undefined, type: SavedType) {
  const { showToast } = useToast();
  const [saved, setSaved] = useState(id ? profileStore.isSaved(id, type) : false);

  useEffect(() => {
    if (!id) return;
    return profileStore.subscribe(() => setSaved(profileStore.isSaved(id, type)));
  }, [id, type]);

  const toggle = useCallback(() => {
    if (!id) return;
    const was = profileStore.isSaved(id, type);
    profileStore.toggleSaved(id, type);
    showToast(was ? 'Removed from saved opportunities' : 'Opportunity saved to your profile', was ? 'info' : 'success');
  }, [id, type, showToast]);

  return [saved, toggle] as const;
}
