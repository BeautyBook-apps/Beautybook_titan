import { useState, useEffect, useRef } from "react";
import { uploadFile } from '@/api/entities';

export function useProfileMedia(user) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const pendingAvatar = useRef(null);
  const pendingCover = useRef(null);

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatar_url || null);
      setCoverUrl(user.cover_url || null);
    }
  }, [user?.avatar_url, user?.cover_url]);

  const selectAvatar = (file) => {
    if (!file) return;
    pendingAvatar.current = file;
    setAvatarUrl(URL.createObjectURL(file));
  };

  const selectCover = (file) => {
    if (!file) return;
    pendingCover.current = file;
    setCoverUrl(URL.createObjectURL(file));
  };

  const setAvatar = (url) => {
    pendingAvatar.current = null;
    setAvatarUrl(url || null);
  };

  const removeAvatar = () => setAvatar("");

  const removeCover = () => {
    pendingCover.current = null;
    setCoverUrl(null);
  };

  const commitMedia = async () => {
    const updates = {};

    if (pendingAvatar.current) {
      setUploadingAvatar(true);
      try {
        const result = await uploadFile({ file: pendingAvatar.current });
        if (result?.file_url) {
          updates.avatar_url = result.file_url;
          setAvatarUrl(result.file_url);
        }
      } catch (e) {
        console.error('[useProfileMedia] Upload avatar failed:', e);
      }
      setUploadingAvatar(false);
      pendingAvatar.current = null;
    }

    if (pendingCover.current) {
      setUploadingCover(true);
      try {
        const result = await uploadFile({ file: pendingCover.current });
        if (result?.file_url) {
          updates.cover_url = result.file_url;
          setCoverUrl(result.file_url);
        }
      } catch (e) {
        console.error('[useProfileMedia] Upload cover failed:', e);
      }
      setUploadingCover(false);
      pendingCover.current = null;
    }

    return updates;
  };

  return {
    avatarUrl,
    coverUrl,
    uploadingAvatar,
    uploadingCover,
    selectAvatar,
    selectCover,
    setAvatar,
    removeAvatar,
    removeCover,
    commitMedia,
  };
}
