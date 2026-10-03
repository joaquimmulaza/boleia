import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Fade sem ellipsis. `lines={1}` corta à direita; `lines={2}` corta a 3.ª linha.
 * A máscara só entra quando o texto não cabe. O nome acessível é o texto completo.
 * @param {{
 *   children: import('react').ReactNode,
 *   as?: keyof JSX.IntrinsicElements,
 *   className?: string,
 *   lines?: 1 | 2,
 * }} props
 */
function TextFade({ children, as: Tag = 'span', className = '', lines = 1 }) {
  const ref = useRef(/** @type {HTMLElement | null} */ (null));
  const [overflowing, setOverflowing] = useState(false);
  const multiline = lines > 1;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      setOverflowing(
        multiline
          ? el.scrollHeight > el.clientHeight + 1
          : el.scrollWidth > el.clientWidth + 1,
      );
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [children, multiline]);

  const fadeClass = overflowing ? (multiline ? 'text-fade-lines' : 'text-fade') : '';
  const capClass = multiline ? 'text-fade-cap' : '';
  const nome = typeof children === 'string' ? children : undefined;

  return (
    <Tag
      ref={ref}
      className={`block min-w-0 ${capClass} ${fadeClass} ${className}`.trim()}
      aria-label={nome}
    >
      {children}
    </Tag>
  );
}

export default TextFade;
