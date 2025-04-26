import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { RouteEntity } from 'src/route/route-page.entity';
import { VideosPage } from '../entities/video-page.entity';

export class VideoRouteDto {
  title: string;
  public: boolean;
  subtitle: string;
  image: string;
  idToFetch: string;
  path: string;
  entityType: string;
  description: string;
  entityId: string;
  type: string;

  static fromEntity(route: RouteEntity): VideoRouteDto {
    return {
      title: route.title,
      public: route.public,
      subtitle: route.subtitle,
      image: route.image,
      idToFetch: route.idToFetch,
      path: route.path,
      entityType: route.entityType,
      description: route.description,
      entityId: route.entityId,
      type: route.type,
    };
  }
}

export class VideosPageResponseDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  route: VideoRouteDto;
  videos: MediaItemEntity[];

  static fromEntity(
    page: VideosPage,
    videos: MediaItemEntity[],
  ): VideosPageResponseDto {
    if (!page.route) {
      throw new Error(`A página de vídeos com id ${page.id} não possui rota associada.`);
    }

    return {
      id: page.id,
      title: page.name,
      description: page.description,
      public: page.public,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      route: VideoRouteDto.fromEntity(page.route),
      videos: videos,
    };
  }
}