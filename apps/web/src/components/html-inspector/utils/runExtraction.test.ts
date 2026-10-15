// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import type { ExtractField } from '../FieldsPanel';
import { runExtraction } from './runExtraction';

const fields: ExtractField[] = [
  {
    id: 'previous',
    label: 'Precio anterior',
    selector: '.old-price',
    type: 'price',
  },
  {
    id: 'current',
    label: 'Precio actual',
    selector: '.current-price',
    type: 'price',
  },
];

describe('runExtraction product price validation', () => {
  it('returns separate valid current and previous prices for the product preview', () => {
    const [previousPrice, currentPrice] = runExtraction(
      '<div class="old-price">MXN $1,234.50</div><div class="current-price">1.099,00 MXN</div>',
      fields
    );

    expect(previousPrice).toMatchObject({
      status: 'success',
      value: 'MXN $1,234.50',
    });
    expect(currentPrice).toMatchObject({
      status: 'success',
      value: '1.099,00 MXN',
    });
  });

  it('does not report an invalid monetary string as a successful extraction', () => {
    const [result] = runExtraction(
      '<div class="old-price">sin precio</div>',
      [fields[0]]
    );

    expect(result).toMatchObject({
      status: 'error',
      value: null,
      message: 'El valor encontrado no es un precio válido',
    });
  });

  it('returns an empty result without manufacturing a value when there is no match', () => {
    const [result] = runExtraction('<main></main>', [fields[0]]);
    expect(result).toMatchObject({
      status: 'error',
      value: null,
      message: 'No se encontró ningún elemento con este selector',
    });
  });
});
