import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb, getAlexaEventsAfter, getAlexaEventsPage, getDb, recordAlexaEvent } from '../src/db/index.js';

describe('getAlexaEventsPage', () => {
  beforeEach(() => {
    closeDb();
    getDb().prepare('DELETE FROM alexa_events').run();
    for (let i = 1; i <= 5; i += 1) {
      recordAlexaEvent({ type: 'TestIntent', summary: `Event ${i}` });
    }
  });

  it('returns newest events first', () => {
    const page = getAlexaEventsPage(0, 3);
    expect(page.items).toHaveLength(3);
    expect(page.items[0].summary).toBe('Event 5');
    expect(page.items[2].summary).toBe('Event 3');
    expect(page.items.every((item) => typeof item.id === 'number')).toBe(true);
  });

  it('paginates with hasMore and nextStart', () => {
    const first = getAlexaEventsPage(0, 2);
    expect(first.hasMore).toBe(true);
    expect(first.nextStart).toBe(2);

    const second = getAlexaEventsPage(first.nextStart, 2);
    expect(second.items.map((item) => item.summary)).toEqual(['Event 3', 'Event 2']);
    expect(second.hasMore).toBe(true);

    const third = getAlexaEventsPage(second.nextStart, 2);
    expect(third.items.map((item) => item.summary)).toEqual(['Event 1']);
    expect(third.hasMore).toBe(false);
  });

  it('returns empty page when offset exceeds total', () => {
    const page = getAlexaEventsPage(100, 10);
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextStart).toBe(100);
  });

  it('caps page size at 100', () => {
    closeDb();
    getDb().prepare('DELETE FROM alexa_events').run();
    for (let i = 1; i <= 105; i += 1) {
      recordAlexaEvent({ type: 'TestIntent', summary: `Bulk ${i}` });
    }
    const page = getAlexaEventsPage(0, 500);
    expect(page.items).toHaveLength(100);
    expect(page.hasMore).toBe(true);
  });
});

describe('getAlexaEventsAfter', () => {
  beforeEach(() => {
    closeDb();
    getDb().prepare('DELETE FROM alexa_events').run();
    for (let i = 1; i <= 5; i += 1) {
      recordAlexaEvent({ type: 'TestIntent', summary: `Event ${i}` });
    }
  });

  it('returns only events newer than afterId in descending order', () => {
    const page = getAlexaEventsPage(0, 5);
    const afterId = page.items.find((item) => item.summary === 'Event 3')!.id;
    const newer = getAlexaEventsAfter(afterId, 10);
    expect(newer.items.map((item) => item.summary)).toEqual(['Event 5', 'Event 4']);
    expect(newer.hasMore).toBe(false);
  });

  it('returns empty result when there are no newer events', () => {
    const page = getAlexaEventsPage(0, 1);
    const newestId = page.items[0].id;
    const newer = getAlexaEventsAfter(newestId, 10);
    expect(newer.items).toEqual([]);
    expect(newer.hasMore).toBe(false);
  });
});
