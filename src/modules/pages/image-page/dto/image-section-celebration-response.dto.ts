/** Resposta de `POST /image-pages/:id/sections/:sectionId/celebrations/toggle`. */
export class ImageSectionCelebrationResponseDto {
  celebrated: boolean;
  celebrationCount: number;
  celebrators: string[];
  /** O autor não celebra a própria publicação. */
  ownPublication?: boolean;
}
