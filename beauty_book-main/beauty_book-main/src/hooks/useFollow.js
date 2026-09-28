import { useState, useEffect, useCallback } from "react";
import { entities } from "@/api/entities";
import { useAuth } from "@/lib/AuthContext";

/**
 * Suivi réel d'un pro via la table `user_follow`.
 * Retourne { followed, loading, toggle }.
 */
export function useFollow(followedEmail) {
  const { user } = useAuth();
  const [followed, setFollowed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.email || !followedEmail || user.email === followedEmail) {
      setFollowed(false);
      return;
    }
    let alive = true;
    entities.UserFollow.filter({ follower_email: user.email, followed_email: followedEmail }, "-created_at", 1)
      .then(rows => { if (alive) setFollowed((rows || []).length > 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.email, followedEmail]);

  const toggle = useCallback(async () => {
    if (!user?.email || !followedEmail || user.email === followedEmail || loading) return false;
    setLoading(true);
    try {
      if (followed) {
        const rows = await entities.UserFollow.filter(
          { follower_email: user.email, followed_email: followedEmail }, "-created_at", 1
        ).catch(() => []);
        await Promise.all((rows || []).map(r => entities.UserFollow.delete(r.id).catch(() => {})));
        setFollowed(false);
        return false;
      }
      await entities.UserFollow.create({
        follower_email: user.email,
        follower_name: user.full_name || "",
        follower_avatar: user.avatar_url || "",
        followed_email: followedEmail,
      });
      setFollowed(true);
      return true;
    } catch {
      return followed;
    } finally {
      setLoading(false);
    }
  }, [user, followedEmail, followed, loading]);

  return { followed, loading, toggle, isSelf: user?.email === followedEmail };
}
