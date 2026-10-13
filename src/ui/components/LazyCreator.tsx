import { useEffect, useState } from 'preact/hooks';
import type { ComponentType } from 'preact';

type Props = { onDone: () => void };
let cached: ComponentType<Props> | null = null;

/** The character creator (and MediaPipe behind it) loads only when opened. */
export function LazyCreator(props: Props) {
  const [C, setC] = useState<ComponentType<Props> | null>(() => cached);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (C) return;
    import('../../character/Creator').then(
      (m) => {
        cached = m.CharacterCreator;
        setC(() => m.CharacterCreator);
      },
      () => setFailed(true),
    );
  }, []);
  if (failed)
    return (
      <main class="screen plain">
        <p class="error" role="alert">
          לא הצלחנו לטעון את יוצר הדמות (אין חיבור?). אפשר לדלג ולנסות אחר כך.
        </p>
        <button type="button" class="btn block" onClick={props.onDone}>
          דילוג
        </button>
      </main>
    );
  if (!C)
    return (
      <main class="screen plain center" aria-busy="true">
        <p class="muted" style={{ marginTop: '30vh' }}>
          טוען את סטודיו הדמויות…
        </p>
      </main>
    );
  return <C {...props} />;
}
