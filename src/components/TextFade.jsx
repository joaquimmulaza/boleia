import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Truncagem single-line com fade lateral — sem ellipsis «…».
 * Aplica máscara só quando o texto overflow.
 * @param {{ children: import('react').ReactNode, as?: keyof JSX.IntrinsicElements, className?: string }} props
 */
function TextFade({ children, as: Tag = 'span', className = '' }) {
  const ref = useRef(/** @type {HTMLElement | null} */ (null));
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      setOverflowing(el.scrollWidth > el.clientWidth + 1);
    };

    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [children]);

  return (
    <Tag
      ref={ref}
      className={`block min-w-0 ${overflowing ? 'text-fade' : ''} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}

export default TextFade;
