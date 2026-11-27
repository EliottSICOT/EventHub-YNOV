import { Button } from '@heroui/react';
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'eventhub:fond-anime-en-pause';

function readPaused(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Animation des lueurs du fond, avec le choix de l'utilisateur mémorisé (WCAG 2.2.2). */
export function useBackgroundMotion() {
  const [paused, setPaused] = useState(readPaused);
  const toggle = useCallback(() => {
    setPaused((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Stockage indisponible (navigation privée…) : le choix vaut pour la session.
      }
      return next;
    });
  }, []);
  return { paused, toggle };
}

/** Lueurs décoratives qui dérivent lentement derrière la page. */
export function BackgroundGlow({ paused }: { paused: boolean }) {
  return (
    <div className="glow-layer" data-paused={paused} aria-hidden="true">
      <div className="glow glow--1" />
      <div className="glow glow--2" />
      <div className="glow glow--3" />
      <div className="glow glow--4" />
      <div className="glow glow--5" />
    </div>
  );
}

/** Bouton pour arrêter ou relancer l'animation du fond (contenu en mouvement > 5 s). */
export function BackgroundMotionToggle({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  return (
    <Button variant="ghost" size="sm" onPress={onToggle}>
      {paused ? "Relancer l'animation du fond" : "Mettre en pause l'animation du fond"}
    </Button>
  );
}
