import { describe, it, expect } from 'vitest';
import { buildValidationPrompt } from './validate-image.js';

describe('buildValidationPrompt', () => {
  it('generates a prompt with all 5 standard checks for a spread page', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['Hello world', 'Once upon a time'],
      heroName: 'James',
      artStyle: 'watercolor',
      pageType: 'spread',
      sceneDescription: 'James in a garden',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('CHECK 1: TEXT ACCURACY');
    expect(prompt).toContain('CHECK 2: CHARACTER QUALITY');
    expect(prompt).toContain('CHECK 3: TEXT BOX CONSISTENCY');
    expect(prompt).toContain('CHECK 4: SCENE ACCURACY');
    expect(prompt).toContain('CHECK 5: FORMAT');
    expect(prompt).not.toContain('CHECK 6: PHOTO LIKENESS');
    expect(prompt).toContain('Hello world');
    expect(prompt).toContain('Once upon a time');
    expect(prompt).toContain('James');
    expect(prompt).toContain('watercolor');
    expect(prompt).toContain('James in a garden');
  });

  it('includes likeness check (CHECK 6) when hasReferencePhoto is true', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['Title text'],
      heroName: 'Emma',
      artStyle: 'cartoon',
      pageType: 'spread',
      sceneDescription: 'Emma at the beach',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: true,
    });

    expect(prompt).toContain('CHECK 6: PHOTO LIKENESS');
    expect(prompt).toContain('likenessScore');
  });

  it('does not include likeness check when hasReferencePhoto is false', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: [],
      heroName: 'Max',
      artStyle: 'digital',
      pageType: 'spread',
      sceneDescription: 'Max running',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).not.toContain('CHECK 6: PHOTO LIKENESS');
    expect(prompt).not.toContain('"likenessScore"');
  });

  it('uses hand-lettered text description for cover pages', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['The Big Adventure'],
      heroName: 'Lily',
      artStyle: 'storybook',
      pageType: 'cover',
      sceneDescription: 'Lily on cover',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('COVER');
    expect(prompt).toContain('HAND-LETTERED');
    expect(prompt).toContain('The Big Adventure');
    // Should NOT have "Text box" framing for covers
    expect(prompt).not.toContain('Text box 1:');
  });

  it('uses text box framing for spread pages', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['Some story text here'],
      heroName: 'Max',
      artStyle: 'watercolor',
      pageType: 'spread',
      sceneDescription: 'A forest scene',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('Text box 1:');
    expect(prompt).toContain('Some story text here');
    expect(prompt).not.toContain('HAND-LETTERED');
  });

  it('handles empty expectedTexts', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: [],
      heroName: 'Max',
      artStyle: 'digital',
      pageType: 'back_cover',
      sceneDescription: 'Back cover design',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('No text boxes expected');
  });

  it('handles null expectedTexts', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: null,
      heroName: 'Max',
      artStyle: 'digital',
      pageType: 'spread',
      sceneDescription: 'A scene',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('No text boxes expected');
  });

  it('includes multi-character descriptions when provided', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['Hello'],
      heroName: 'James',
      artStyle: 'cartoon',
      pageType: 'spread',
      sceneDescription: 'James and Luna playing',
      characterDescriptions: [
        { name: 'James', relationship: 'main character', hasPhoto: true },
        { name: 'Luna', relationship: 'sister', hasPhoto: false },
      ],
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('EXPECTED CHARACTERS');
    expect(prompt).toContain('James');
    expect(prompt).toContain('Luna');
    expect(prompt).toContain('sister');
    expect(prompt).toContain('has reference photo uploaded');
  });

  it('uses single character description when characterDescriptions has 1 or fewer items', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['Hello'],
      heroName: 'James',
      artStyle: 'cartoon',
      pageType: 'spread',
      sceneDescription: 'James alone',
      characterDescriptions: [{ name: 'James', relationship: 'main', hasPhoto: false }],
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).not.toContain('EXPECTED CHARACTERS');
    expect(prompt).toContain('CHARACTER:');
    expect(prompt).toContain('James');
  });

  it('includes previous page style reference when provided', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['text'],
      heroName: 'Max',
      artStyle: 'watercolor',
      pageType: 'spread',
      sceneDescription: 'Scene',
      characterDescriptions: null,
      previousPageStyle: 'Cloud-shaped white semi-transparent boxes with handwritten blue text',
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('EXPECTED STYLE (MUST match the first page)');
    expect(prompt).toContain('Cloud-shaped white semi-transparent boxes');
  });

  it('asks to describe text box style on first interior page (no previousPageStyle)', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['text'],
      heroName: 'Max',
      artStyle: 'watercolor',
      pageType: 'spread',
      sceneDescription: 'Scene',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('This is the FIRST interior page');
    expect(prompt).toContain('Describe the text box style');
  });

  it('returns valid JSON schema in the output section', () => {
    const prompt = buildValidationPrompt({
      expectedTexts: ['text'],
      heroName: 'Max',
      artStyle: 'watercolor',
      pageType: 'spread',
      sceneDescription: 'Scene',
      characterDescriptions: null,
      previousPageStyle: null,
      hasReferencePhoto: false,
    });

    expect(prompt).toContain('"pass"');
    expect(prompt).toContain('"textScore"');
    expect(prompt).toContain('"faceScore"');
    expect(prompt).toContain('"textBoxScore"');
    expect(prompt).toContain('"sceneAccuracy"');
    expect(prompt).toContain('"formatOk"');
    expect(prompt).toContain('"issues"');
    expect(prompt).toContain('"fixNotes"');
    expect(prompt).toContain('"textBoxDescription"');
    expect(prompt).toContain('"characterCount"');
    expect(prompt).toContain('"fingersOk"');
  });
});
