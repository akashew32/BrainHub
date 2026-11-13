/** Public navigation metadata and profile-owned bookmark state, never assessment keys. */
export type TopicBookmark = {
  roadmap_slug: string;
  topic_slug: string;
  bookmarked: boolean;
  revision: number;
  updated_at: string | null;
  available: boolean;
  study_url: string | null;
};
export type TopicBookmarksResponse = { items: TopicBookmark[] };
export type TopicBookmarkUpdate = { bookmarked: boolean; revision: number };
export type CurriculumIndex = {
  version: 1;
  pass_score: number;
  roadmaps: Array<{
    slug: string;
    stage_index: number;
    lessons: Array<{ topic_slug: string; title: string; question_count: number }>;
  }>;
};
export function bookmarkKey(roadmapSlug: string, topicSlug: string): string {
  return `${roadmapSlug}:${topicSlug}`;
}
