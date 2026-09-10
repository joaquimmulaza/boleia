import { createPortal } from 'react-dom';

/**
 * Renderiza filhos em document.body para escapar stacking context de main/layout.
 * @param {{ children: import('react').ReactNode }} props
 */
function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export default ModalPortal;
