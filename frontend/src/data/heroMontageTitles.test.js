import titles from './heroMontageTitles.json';

test('each film has distinct, readable Romanian copy timed inside its 30-second chapter', () => {
  expect(titles).toHaveLength(3);
  const allTexts = [];
  titles.forEach((chapter, index) => {
    expect(chapter.duration).toBe(30);
    expect(chapter.cues.length).toBeGreaterThanOrEqual(4);
    chapter.cues.forEach(cue => {
      expect(cue.start).toBeGreaterThanOrEqual(0);
      expect(cue.end).toBeLessThanOrEqual(30);
      expect(cue.end).toBeGreaterThan(cue.start);
      expect(cue.lines.every(line => line.length <= 25)).toBe(true);
      allTexts.push(`${index}:${cue.lines.join(' ')}`);
    });
  });
  expect(new Set(allTexts).size).toBe(allTexts.length);
});
