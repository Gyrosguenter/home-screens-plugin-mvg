import { describe, expect, it } from 'vitest';
import {
  ALL_TRANSPORT_TYPES,
  fetchLimit,
  matchesDestination,
  parseDestinations,
  parseTransportTypes,
} from './filters';

describe('parseTransportTypes', () => {
  it('versteht U und S (Schreibweise egal)', () => {
    expect(parseTransportTypes('U, S')).toEqual(['UBAHN', 'SBAHN']);
    expect(parseTransportTypes('u-bahn; S-Bahn')).toEqual(['UBAHN', 'SBAHN']);
  });

  it('Bus umfasst auch Regionalbusse, Duplikate entfallen', () => {
    expect(parseTransportTypes('Bus')).toEqual(['BUS', 'REGIONAL_BUS']);
    expect(parseTransportTypes('bus, Regionalbus')).toEqual(['BUS', 'REGIONAL_BUS']);
  });

  it('leere oder unbekannte Eingabe zeigt alles', () => {
    expect(parseTransportTypes('')).toEqual(ALL_TRANSPORT_TYPES);
    expect(parseTransportTypes(undefined)).toEqual(ALL_TRANSPORT_TYPES);
    expect(parseTransportTypes('Zeppelin')).toEqual(ALL_TRANSPORT_TYPES);
  });

  it('ignoriert unbekannte Kürzel neben bekannten', () => {
    expect(parseTransportTypes('U, Zeppelin')).toEqual(['UBAHN']);
  });
});

describe('parseDestinations / matchesDestination', () => {
  it('trennt an Komma und Semikolon, ohne Groß-/Kleinschreibung', () => {
    expect(parseDestinations('Marienplatz, Münchner Freiheit')).toEqual([
      'marienplatz',
      'münchner freiheit',
    ]);
    expect(parseDestinations('')).toEqual([]);
    expect(parseDestinations(42)).toEqual([]);
  });

  it('leerer Filter lässt alles durch', () => {
    expect(matchesDestination('Aidenbachstraße', [])).toBe(true);
  });

  it('filtert per Teilstring', () => {
    const filters = parseDestinations('Marienplatz, Münchner Freiheit');
    expect(matchesDestination('Marienplatz', filters)).toBe(true);
    expect(matchesDestination('Münchner Freiheit', filters)).toBe(true);
    expect(matchesDestination('Forstenrieder Park', filters)).toBe(false);
    expect(matchesDestination('Aidenbachstraße', filters)).toBe(false);
  });
});

describe('fetchLimit', () => {
  it('ohne Filter genau so viele wie angezeigt werden', () => {
    expect(fetchLimit(8, [])).toBe(8);
    expect(fetchLimit(8, [], ALL_TRANSPORT_TYPES)).toBe(8);
  });

  it('mit Zielfilter deutlich mehr, gedeckelt', () => {
    expect(fetchLimit(5, ['x'])).toBe(60);
    expect(fetchLimit(20, ['x'])).toBe(100);
  });

  it('mit Verkehrsmittel-Filter ebenfalls mehr (API kürzt vor dem Filter)', () => {
    expect(fetchLimit(6, [], ['UBAHN', 'SBAHN'])).toBe(60);
  });
});
