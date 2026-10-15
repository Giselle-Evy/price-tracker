import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// FIELD
// ─────────────────────────────────────────────────────────────

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;

  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.values(value).every(isJsonValue)
  );
}

const fieldSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'El nombre del campo es obligatorio')
    .max(80, 'El nombre del campo es demasiado largo'),

  selector: z
    .string()
    .trim()
    .min(1, 'El selector es obligatorio')
    .max(2000, 'El selector es demasiado largo'),

  attribute: z
    .string()
    .trim()
    .max(80, 'El atributo es demasiado largo')
    .optional()
    .nullable()
    .transform((v) => (v === '' || v === null ? undefined : v)),

  type: z.enum(['text', 'price', 'image', 'url'], {
    errorMap: () => ({ message: 'Tipo de campo inválido' }),
  }),

  transform: z.custom<JsonValue>(isJsonValue).optional().nullable(),

  isPrimary: z.boolean().optional().default(false),

  orderIndex: z.number().int().min(0).optional().default(0),
});

// ─────────────────────────────────────────────────────────────
// CREATE CONFIG
// ─────────────────────────────────────────────────────────────

export const createConfigSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),

  sourceUrl: z
    .string()
    .trim()
    .url('La URL de origen no es válida')
    .max(2048, 'La URL es demasiado larga'),

  fields: z
    .array(fieldSchema)
    .min(1, 'Debe haber al menos un campo')
    .max(50, 'No se pueden agregar más de 50 campos'),
});

export type CreateConfigInput = z.infer<typeof createConfigSchema>;

// ─────────────────────────────────────────────────────────────
// UPDATE CONFIG
// ─────────────────────────────────────────────────────────────

export const updateConfigSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo')
    .optional(),

  status: z.enum(['draft', 'active', 'error', 'archived']).optional(),

  sourceUrl: z
    .string()
    .trim()
    .url('La URL de origen no es válida')
    .max(2048, 'La URL es demasiado larga')
    .optional(),

  fields: z
    .array(fieldSchema)
    .min(1, 'Debe haber al menos un campo')
    .max(50, 'No se pueden agregar más de 50 campos')
    .optional(),
});

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>;

// ─────────────────────────────────────────────────────────────
// LIST / GET / DELETE
// ─────────────────────────────────────────────────────────────

export const configIdParamSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export type ConfigIdParam = z.infer<typeof configIdParamSchema>;