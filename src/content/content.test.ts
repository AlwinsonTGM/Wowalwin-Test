import { describe, expect, it } from 'vitest';
import {
  allQuestions,
  bankProblems,
  boutQuestions,
  cullQuestions,
  findQuestion,
  forPresenter,
  questionProblems,
  type Question,
} from './questions.ts';
import { Bokya, hasPlaceholderPrizes, kahonPrizes, kahonTable, Pera } from './prizes.ts';
import { entrepreneurs, moduleBlocks, trimTools } from './deck.ts';

describe('the question bank', () => {
  it('passes whole-bank validation cleanly', () => {
    expect(bankProblems()).toEqual([]);
  });

  it('provides separate pools for cull and bout', () => {
    expect(cullQuestions.length).toBeGreaterThanOrEqual(10);
    expect(boutQuestions.length).toBeGreaterThanOrEqual(10);
    expect(allQuestions).toHaveLength(cullQuestions.length + boutQuestions.length);
  });

  it('exposes forPresenter with answer label and cue', () => {
    const q1 = cullQuestions[0]!;
    const presenter = forPresenter(q1.id);
    expect(presenter?.answer).toBe(q1.options.find((o) => o.id === q1.correctOptionId)?.label);
    expect(presenter?.cue).toBe(q1.cue);
  });

  it('returns null forPresenter on unknown question', () => {
    expect(forPresenter('unknown-id')).toBeNull();
  });

  it('finds questions by id across both pools', () => {
    expect(findQuestion(cullQuestions[0]!.id)).toBeDefined();
    expect(findQuestion(boutQuestions[0]!.id)).toBeDefined();
    expect(findQuestion('ghost')).toBeUndefined();
  });

  it('flags malformed questions', () => {
    const valid: Question = cullQuestions[0]!;
    const seen = new Set<string>();

    expect(questionProblems({ ...valid, id: '' }, 'cull', seen)).toContain('cull/(no id): has no id');
    expect(questionProblems({ ...valid, prompt: '   ' }, 'cull', seen)).toContain('cull/c1-bakit-magplano: prompt is empty');
    expect(questionProblems({ ...valid, cue: '' }, 'cull', seen)).toContain('cull/c1-bakit-magplano: has no Presenter cue');
    expect(questionProblems({ ...valid, options: valid.options.slice(0, 3) }, 'cull', seen)).toContain(
      'cull/c1-bakit-magplano: has 3 options, expected 4',
    );
    expect(questionProblems({ ...valid, correctOptionId: 'z' }, 'cull', seen)).toContain(
      'cull/c1-bakit-magplano: the answer key "z" is not one of its options',
    );
  });
});

describe('the prize table', () => {
  it('contains Pera, Bokya, and the Kahon prizes', () => {
    expect(Pera.id).toBe('pera');
    expect(Bokya.id).toBe('bokya');
    expect(kahonPrizes).toHaveLength(8);
    expect(kahonTable).toHaveLength(9);
  });

  it('marks placeholders until replaced', () => {
    expect(hasPlaceholderPrizes()).toBe(true);
    expect(Bokya.placeholder).toBe(false);
  });
});

describe('the deck', () => {
  it('covers the 5 TRIM instruments in depth', () => {
    expect(trimTools).toHaveLength(5);
    for (const tool of trimTools) {
      expect(tool.covers.length).toBeGreaterThan(0);
      expect(tool.purpose.length).toBeGreaterThan(0);
    }
  });

  it('covers the 8 entrepreneurs with their initial failures', () => {
    expect(entrepreneurs).toHaveLength(8);
    for (const person of entrepreneurs) {
      expect(person.failedAt.length).toBeGreaterThan(0);
      expect(person.knownFor.length).toBeGreaterThan(0);
      expect(person.lesson.length).toBeGreaterThan(0);
    }
  });

  it('has 3 module blocks', () => {
    expect(moduleBlocks).toHaveLength(3);
  });
});
