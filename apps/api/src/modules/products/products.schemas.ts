import { z } from 'zod';

const httpUrlSchema = z
  .string()
  .trim()
  .url('Debe ser una URL válida')
  .max(2048, 'La URL es demasiado larga')
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'La URL debe usar HTTP o HTTPS');

const imageSchema = z.object({
  url: httpUrlSchema,
  alt: z.string().max(2000).nullable().optional(),
  source: z.string().max(500).nullable().optional(),
  order: z.number().int().positive().optional(),
});

const priceSchema = z
  .number()
  .positive('El precio debe ser mayor que cero')
  .max(9999999999.99, 'El precio excede el máximo admitido')
  .refine((value) => Number(value.toFixed(2)) === value, 'El precio admite hasta dos decimales');

export const saveProductSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del producto es obligatorio').max(500),
  url: httpUrlSchema,
  description: z.string().trim().max(20000).nullable().optional(),
  currentPrice: priceSchema.nullable().optional(),
  previousPrice: priceSchema.nullable().optional(),
  currency: z.string().trim().max(8).nullable().optional(),
  imageUrl: httpUrlSchema.nullable().optional(),
  images: z.array(imageSchema).default([]),
});

export const productIdParamSchema = z.object({
  id: z.string().uuid('ID de producto inválido'),
});

export type SaveProductInput = z.infer<typeof saveProductSchema>;
