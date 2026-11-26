export type DocxImageType = 'png' | 'jpg';

export interface ImageDimensions {
  width: number;
  height: number;
  type: DocxImageType | 'webp';
}

export interface ImageBox {
  width: number;
  height: number;
}

export interface FittedImage {
  width: number;
  height: number;
  type: DocxImageType;
}
