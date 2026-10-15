import { beforeEach, describe, expect, it, vi } from 'vitest';

const { add, removeRepeatable } = vi.hoisted(() => ({
  add: vi.fn(),
  removeRepeatable: vi.fn(),
}));

vi.mock('./scrapeQueue.js', () => ({
  scrapeQueue: { add, removeRepeatable },
}));

import { scheduleMonitor } from './scheduler.js';

describe('monitor scheduler frequencies', () => {
  beforeEach(() => {
    add.mockReset().mockResolvedValue(undefined);
    removeRepeatable.mockReset().mockResolvedValue(true);
  });

  it.each([
    ['m5', 5 * 60 * 1000],
    ['m10', 10 * 60 * 1000],
    ['m15', 15 * 60 * 1000],
    ['m30', 30 * 60 * 1000],
  ] as const)('schedules %s using the matching interval', async (frequencyMin, every) => {
    const monitorId = 'monitor-id';
    const userId = 'user-id';

    await scheduleMonitor({ id: monitorId, userId, frequencyMin });

    expect(add).toHaveBeenCalledWith(
      'scrape-monitor',
      { monitorId, userId },
      {
        repeat: { every },
        jobId: `monitor-${monitorId}-${frequencyMin}`,
      }
    );
  });
});
