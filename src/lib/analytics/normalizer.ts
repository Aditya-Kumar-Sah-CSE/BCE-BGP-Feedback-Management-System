/**
 * Normalization Layer for BCE Faculty Feedback
 * Converts arbitrary Google Sheet rows into canonical 8-parameter feedback records.
 */

import { BCE_FEEDBACK_PARAMETERS } from '@/lib/google/template';
import { CanonicalResponseRow, RatingOption } from './types';

// Keyword rules for robust column header matching
const PARAMETER_KEYWORD_RULES: Record<number, string[]> = {
  1: ['syllabus', 'coverage', 'prescribed course'],
  2: ['communication', 'clarity of speech', 'presentation'],
  3: ['teaching-learning', 'effectiveness', 'pacing of lectures', 'conceptual depth'],
  4: ['accessibility', 'accessible', 'outside scheduled', 'guidance'],
  5: ['willingness', 'offer help', 'resolving student doubts', 'assistance'],
  6: ['teach/explain', 'explain', 'examples', 'illustrations', 'problem-solving'],
  7: ['fairness', 'evaluation', 'impartiality', 'grading', 'assessment'],
  8: ['overall rating', 'comprehensive overall', 'overall performance', 'overall'],
};

/**
 * Maps a raw cell value to a canonical RatingOption ('Very Good' | 'Good' | 'Satisfactory' | 'Unsatisfactory') or null.
 */
export function normalizeRatingValue(val: string | number | undefined | null): RatingOption | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim().toLowerCase();

  if (!str || str === 'n/a' || str === '-' || str === 'na' || str === 'none') {
    return null;
  }

  // Exact / substring matching
  if (str === 'very good' || str.includes('very good') || str === 'vg' || str === '4') {
    return 'Very Good';
  }
  if (str === 'unsatisfactory' || str.includes('unsatisfactory') || str === 'unsat' || str === 'poor' || str === '1') {
    return 'Unsatisfactory';
  }
  if (str === 'satisfactory' || str.includes('satisfactory') || str === 'average' || str === 'sat' || str === '2') {
    return 'Satisfactory';
  }
  if (str === 'good' || str.includes('good') || str === 'g' || str === '3') {
    return 'Good';
  }

  return null;
}

export interface ColumnMapping {
  timestampColIndex: number;
  responseIdColIndex: number;
  paramColIndices: Record<number, number>; // paramId (1..8) -> colIndex
}

/**
 * Inspects sheet headers and determines column positions without relying on fixed index positions.
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    timestampColIndex: -1,
    responseIdColIndex: -1,
    paramColIndices: {},
  };

  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());

  // 1. Identify Timestamp and Response ID
  normalizedHeaders.forEach((header, index) => {
    if (header.includes('timestamp') || header === 'date' || header === 'time') {
      if (mapping.timestampColIndex === -1) mapping.timestampColIndex = index;
    } else if (header.includes('response id') || header === 'id' || header.includes('submission id')) {
      if (mapping.responseIdColIndex === -1) mapping.responseIdColIndex = index;
    }
  });

  // 2. Identify 8 BCE Parameters
  BCE_FEEDBACK_PARAMETERS.forEach(param => {
    const pId = param.id;
    const pTitle = param.title.toLowerCase();
    const keywords = PARAMETER_KEYWORD_RULES[pId] || [];

    // First try: Header starting with "${pId}." or "${pId}:" or "${pId} -" or exact param title
    let matchIdx = normalizedHeaders.findIndex(
      h =>
        h.startsWith(`${pId}.`) ||
        h.startsWith(`${pId}:`) ||
        h.startsWith(`${pId} -`) ||
        h.startsWith(`${pId} `) ||
        h.includes(pTitle)
    );

    // Second try: Keyword search
    if (matchIdx === -1) {
      matchIdx = normalizedHeaders.findIndex(h =>
        keywords.some(kw => h.includes(kw))
      );
    }

    if (matchIdx !== -1) {
      mapping.paramColIndices[pId] = matchIdx;
    }
  });

  // Fallback: If headers were generic or empty, try standard Phase 2 layout
  // Column 0: Timestamp, Column 1: Response ID, Columns 2..9: Parameters 1..8
  if (Object.keys(mapping.paramColIndices).length === 0 && headers.length >= 8) {
    const offset = mapping.timestampColIndex !== -1 && mapping.responseIdColIndex !== -1 ? 2 : 0;
    for (let i = 1; i <= 8; i++) {
      const fallbackCol = offset + (i - 1);
      if (fallbackCol < headers.length) {
        mapping.paramColIndices[i] = fallbackCol;
      }
    }
  }

  return mapping;
}

/**
 * Normalizes raw Google Sheet response rows into canonical response structures.
 * Resilient against missing columns, malformed values, and blank lines.
 */
export function normalizeSheetRows(
  headers: string[],
  rawRows: string[][]
): CanonicalResponseRow[] {
  if (!rawRows || rawRows.length === 0) {
    return [];
  }

  const mapping = detectColumnMapping(headers);
  const results: CanonicalResponseRow[] = [];

  rawRows.forEach((row, rowIdx) => {
    // Check if row is completely empty
    if (!row || row.length === 0 || row.every(cell => !cell || !cell.trim())) {
      return;
    }

    const timestamp =
      mapping.timestampColIndex !== -1 && row[mapping.timestampColIndex]
        ? row[mapping.timestampColIndex].trim()
        : '';

    const responseId =
      mapping.responseIdColIndex !== -1 && row[mapping.responseIdColIndex]
        ? row[mapping.responseIdColIndex].trim()
        : `row-${rowIdx + 1}`;

    const ratings: Record<number, RatingOption | null> = {};
    let validRatingsCount = 0;

    for (let pId = 1; pId <= 8; pId++) {
      const colIdx = mapping.paramColIndices[pId];
      if (colIdx !== undefined && colIdx < row.length) {
        const normalizedVal = normalizeRatingValue(row[colIdx]);
        ratings[pId] = normalizedVal;
        if (normalizedVal !== null) {
          validRatingsCount++;
        }
      } else {
        ratings[pId] = null;
      }
    }

    // A row is considered a valid response if at least one parameter was answered
    const isValid = validRatingsCount > 0;

    results.push({
      timestamp,
      responseId,
      ratings,
      isValid,
    });
  });

  return results;
}
