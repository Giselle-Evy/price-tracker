import { describe, expect, it } from 'vitest';

import type { ExtractionResult } from '../html-inspector/utils/runExtraction';
import {
  mergeManualProductFields,
  mergeManualProductImages,
  parseProductPrice,
} from './productFields';

function extraction(
  label: string,
  type: string,
  value: string | null,
  status: ExtractionResult['status'] = 'success',
  selector = '.selector'
): ExtractionResult {
  return {
    fieldId: label,
    label,
    selector,
    type,
    status,
    value,
    values: value ? [value] : [],
    matchCount: value ? 1 : 0,
  };
}

describe('product field extraction mapping', () => {
  it('updates only the previous-price field from a valid manual selector', () => {
    const automaticFields = [
      { label: 'Precio anterior', value: '$120.00' },
      { label: 'Precio', value: '$99.50' },
    ];

    expect(
      mergeManualProductFields(automaticFields, [
        extraction('Precio anterior', 'price', 'MXN $110.25', 'success', '.old-price'),
      ])
    ).toEqual([
      { label: 'Precio antiguo', value: 'MXN $110.25' },
      { label: 'Precio', value: '$99.50' },
    ]);
    expect(automaticFields[0].value).toBe('$120.00');
  });

  it('adds current and previous prices to their distinct product fields', () => {
    expect(
      mergeManualProductFields([], [
        extraction('Precio anterior', 'price', '$120.00'),
        extraction('Precio actual', 'price', '$99.50'),
      ])
    ).toEqual([
      { label: 'Precio antiguo', value: '$120.00' },
      { label: 'Precio nuevo', value: '$99.50' },
    ]);
  });

  it('does not overwrite a valid automatic value with an empty or invalid selector result', () => {
    const automaticFields = [{ label: 'Precio anterior', value: '$120.00' }];
    expect(
      mergeManualProductFields(automaticFields, [
        extraction('Precio anterior', 'price', null, 'empty', '.missing'),
      ])
    ).toBe(automaticFields);
    expect(
      mergeManualProductFields(automaticFields, [
        extraction('Precio anterior', 'price', 'no es un precio'),
      ])
    ).toBe(automaticFields);
  });

  it('maps other supported product fields and preserves unrelated configured fields', () => {
    expect(
      mergeManualProductFields(
        [{ label: 'Nombre', value: 'Nombre automático' }],
        [
          extraction('Nombre', 'text', 'Nombre manual'),
          extraction('Descripción', 'text', 'Detalle manual'),
          extraction('Moneda', 'text', 'MXN'),
          extraction('Marca', 'text', 'Marca no persistida'),
        ]
      )
    ).toEqual([
      { label: 'Nombre del producto', value: 'Nombre manual' },
      { label: 'Descripción', value: 'Detalle manual' },
      { label: 'Moneda', value: 'MXN' },
    ]);
  });

  it('does not map an unrelated custom price field into the product current price', () => {
    expect(
      mergeManualProductFields([], [
        extraction('Costo de envío', 'price', '$20.00'),
      ])
    ).toEqual([]);
  });

  it('accepts the monetary formats already supported and rejects unusable amounts', () => {
    expect(parseProductPrice('MXN $1,234.50')).toBe(1234.5);
    expect(parseProductPrice('1.234,50 €')).toBe(1234.5);
    expect(parseProductPrice('0')).toBeNull();
    expect(parseProductPrice('12.345')).toBe(12345);
  });

  it('uses the latest selector test result rather than retaining a previous manual value', () => {
    const confirmed = [{ label: 'Precio anterior', value: '$110.00' }];
    const failedLatestTest = [
      extraction('Precio anterior', 'price', null, 'empty', '.changed-selector'),
    ];

    expect(
      mergeManualProductFields(
        [{ label: 'Precio anterior', value: '$120.00' }],
        failedLatestTest
      )
    ).toEqual([{ label: 'Precio anterior', value: '$120.00' }]);
    expect(confirmed).toEqual([{ label: 'Precio anterior', value: '$110.00' }]);
  });

  it('uses successful manual image results for the confirmation gallery without preserving stale choices', () => {
    const detected = [
      { url: 'https://cdn.example/automatic.jpg', alt: 'Auto', source: 'gallery' },
    ];
    expect(
      mergeManualProductImages(detected, [
        {
          ...extraction('Imagen del producto', 'image', 'https://cdn.example/manual.jpg'),
          values: ['https://cdn.example/manual.jpg'],
        },
      ])
    ).toEqual([
      {
        url: 'https://cdn.example/manual.jpg',
        alt: null,
        source: 'manual-selector',
        order: 1,
      },
    ]);
    expect(
      mergeManualProductImages(detected, [
        extraction('Imagen del producto', 'image', null, 'empty'),
      ])
    ).toBe(detected);
  });
});
