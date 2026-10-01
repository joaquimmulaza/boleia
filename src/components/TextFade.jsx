import React from 'react';

/**
 * Truncagem single-line com fade lateral — sem ellipsis «…».
 * @param {{ children: import('react').ReactNode, as?: keyof JSX.IntrinsicElements, className?: string }} props
 */
function TextFade({ children, as: Tag = 'span', className = '' }) {
  return (
    <Tag className={`text-fade block min-w-0 ${className}`.trim()}>{children}</Tag>
  );
}

export default TextFade;
