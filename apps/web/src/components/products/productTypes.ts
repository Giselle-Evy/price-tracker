import type { ProductImagePreview } from '../html-inspector/ProductImageGallery';

export type SavedProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  images: ProductImagePreview[];
  description: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  canonicalUrl: string;
  originalUrl: string;
  domain: string;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BuilderDraftState = {
  fields: Array<{
    id: string;
    label: string;
    selector: string;
    attribute?: string;
    type: 'text' | 'price' | 'image' | 'url';
    transform?: import('../html-inspector/FieldsPanel').JsonValue | null;
    isPrimary?: boolean;
  }>;
};
