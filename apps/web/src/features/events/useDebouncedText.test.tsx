import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { useDebouncedText } from './useDebouncedText';

const DELAY = 300;

function setup(initial?: string) {
  const apply = vi.fn<(value: string | undefined) => void>();
  const { result } = renderHook(() => {
    const [applied, setApplied] = useState(initial);
    const [send] = useState(() => (value: string | undefined) => {
      apply(value);
      setApplied(value);
    });
    const [text, setText] = useDebouncedText(applied, send, DELAY);
    return { text, setText, setApplied };
  });
  return { apply, result };
}

describe('useDebouncedText', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it("n'applique la saisie qu'une fois, après la pause de frappe", () => {
    const { apply, result } = setup();
    for (const text of ['j', 'ja', 'jaz', 'jazz']) {
      act(() => result.current.setText(text));
      act(() => vi.advanceTimersByTime(DELAY - 1));
    }
    expect(apply).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(apply.mock.calls).toEqual([['jazz']]);
  });

  it("garde l'espace tapé avant la pause, pour saisir le mot suivant", () => {
    const { apply, result } = setup();
    act(() => result.current.setText('nuit '));
    act(() => vi.advanceTimersByTime(DELAY));
    expect(apply).toHaveBeenLastCalledWith('nuit');
    expect(result.current.text).toBe('nuit ');
  });

  it('se resynchronise sur un changement extérieur, y compris vers une valeur déjà envoyée', () => {
    const { result } = setup();
    act(() => result.current.setText('jazz'));
    act(() => vi.advanceTimersByTime(DELAY));

    act(() => result.current.setApplied(undefined)); // Réinitialiser
    expect(result.current.text).toBe('');
    act(() => result.current.setApplied('jazz')); // Précédent
    expect(result.current.text).toBe('jazz');
  });

  it('vide le filtre quand la saisie ne contient que des espaces', () => {
    const { apply, result } = setup('jazz');
    act(() => result.current.setText('   '));
    act(() => vi.advanceTimersByTime(DELAY));
    expect(apply.mock.calls).toEqual([[undefined]]);
  });
});
