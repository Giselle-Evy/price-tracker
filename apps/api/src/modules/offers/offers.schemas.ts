import { z } from 'zod';

const priceSchema = z
  .number()
  .positive('El precio debe ser mayor que cero')
  .max(9999999999.99, 'El precio excede el máximo admitido')
  .refine((value) => Number(value.toFixed(2)) === value, 'El precio admite hasta dos decimales');

export const createOfferSchema = z.object({
  productId: z.string().uuid('ID de producto inválido'),
  title: z.string().trim().min(1, 'El título es obligatorio').max(500),
  description: z.string().trim().max(20000).nullable().optional(),
  price: priceSchema.nullable().optional(),
  previousPrice: priceSchema.nullable().optional(),
});

export const updateOfferSchema = z
  .object({
    title: z.string().trim().min(1, 'El título es obligatorio').max(500).optional(),
    description: z.string().trim().max(20000).nullable().optional(),
    price: priceSchema.nullable().optional(),
    previousPrice: priceSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Debe proporcionarse al menos un campo');

export const offerIdParamSchema = z.object({
  id: z.string().uuid('ID de oferta inválido'),
});

export const listOffersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
