import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Mede overflow horizontal e liga classe condicional.
 * @param {string} value
 * @returns {{ ref: React.RefObject<HTMLSpanElement | null>, truncated: boolean }}
 */
function useHorizontalOverflow(value) {
  const ref = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    const measure = () => {
      setTruncated(el.scrollWidth > el.clientWidth + 0.5);
    };

    const frameId = requestAnimationFrame(measure);

    if (typeof ResizeObserver === 'undefined') {
      return () => cancelAnimationFrame(frameId);
    }

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
    };
  }, [value]);

  return { ref, truncated };
}

/**
 * Span OD de 1 linha com fade horizontal condicional.
 * @param {{
 *   text: string,
 *   align: 'end' | 'start',
 *   className?: string,
 * }} props
 */
function OdSideText({ text, align, className }) {
  const { ref, truncated } = useHorizontalOverflow(text);
  const fadeSide = align === 'end' ? 'truncate-fade-x-start' : 'truncate-fade-x-end';

  return (
    <span
      ref={ref}
      title={text}
      className={cn(
        'min-w-0 max-w-[44%] overflow-hidden whitespace-nowrap truncate-fade-x',
        align === 'end' ? 'text-end' : 'text-start',
        fadeSide,
        truncated && 'is-truncated',
        className,
      )}
    >
      {text}
    </span>
  );
}

/**
 * Par origem → destino compacto (flex 1 linha + fade só se overflow).
 *
 * @param {{
 *   origem?: string | null,
 *   destino?: string | null,
 *   arrowSize?: number,
 *   className?: string,
 *   textClassName?: string,
 * }} props
 */
export default function RouteOdRow({
  origem,
  destino,
  arrowSize = 16,
  className,
  textClassName,
}) {
  const origemValue = typeof origem === 'string' ? origem.trim() : '';
  const destinoValue = typeof destino === 'string' ? destino.trim() : '';
  if (!origemValue && !destinoValue) return null;

  return (
    <div
      className={cn(
        'flex flex-row items-center gap-2 w-fit max-w-full min-w-0 font-bold text-slate-900 dark:text-white',
        className,
      )}
    >
      {origemValue ? (
        <OdSideText text={origemValue} align="end" className={textClassName} />
      ) : (
        <span className="min-w-0 max-w-[44%]" aria-hidden="true" />
      )}
      <span className="shrink-0 self-center flex items-center justify-center">
        <ArrowRight
          size={arrowSize}
          className="text-slate-400 shrink-0"
          aria-hidden="true"
        />
      </span>
      {destinoValue ? (
        <OdSideText text={destinoValue} align="start" className={textClassName} />
      ) : (
        <span className="min-w-0 max-w-[44%]" aria-hidden="true" />
      )}
    </div>
  );
}
