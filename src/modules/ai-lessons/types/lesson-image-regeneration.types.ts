/** What a selective regeneration keeps and what it pays for again. */
export interface LessonImageRegenerationPlan {
  /** Asset id → stored URL of every image that stays as it is. */
  keptAssetUrls: Record<string, string>;
  /** Asset ids to generate again, in the order of the item. */
  regeneratedAssetIds: string[];
  totalImages: number;
}
