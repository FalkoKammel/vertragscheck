// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { AnalysisProgress, type AnalysisPhase } from './AnalysisProgress';

/** Per step: the label and whether the step shows the done check. */
function steps(): { label: string; done: boolean }[] {
  return [...document.querySelectorAll('ol > li')].map((li) => ({
    label: li.textContent.replace('✓', ''),
    done: li.textContent.includes('✓'),
  }));
}

describe('AnalysisProgress', () => {
  it.each<[AnalysisPhase, boolean[]]>([
    ['uploading', [false, false, false]],
    ['extracting', [true, false, false]],
    ['analysing', [true, true, false]],
  ])('marks the finished steps as done while %s', (phase, done) => {
    renderWithProviders(<AnalysisProgress phase={phase} />);
    expect(steps().map((s) => s.done)).toEqual(done);
  });

  it('marks exactly the current step as active', () => {
    renderWithProviders(<AnalysisProgress phase="analysing" />);
    const active = document.querySelectorAll('li[aria-current="step"]');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toBe('Klauseln werden analysiert');
  });
});
