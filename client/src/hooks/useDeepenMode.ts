// hooks/useDeepenMode.ts
// ----------------------------------------------------------------------------
// True when a Core intake step was entered standalone from the "Deepen your
// Mirror" dashboard card (deep-link carries ?deepen=1). Steps use this to save
// their single section and return to the dashboard, instead of continuing the
// full linear intake chain.
// ----------------------------------------------------------------------------

import { useSearchParams } from 'react-router-dom';

export function useDeepenMode(): boolean {
  const [params] = useSearchParams();
  return params.get('deepen') === '1';
}
