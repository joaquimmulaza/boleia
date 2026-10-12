import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * @param {React.HTMLAttributes<HTMLDivElement>} props
 */
function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  );
}

/**
 * @param {React.HTMLAttributes<HTMLDivElement>} props
 */
function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />;
}

/**
 * @param {React.HTMLAttributes<HTMLHeadingElement>} props
 */
function CardTitle({ className, ...props }) {
  return <h3 className={cn('font-semibold leading-none tracking-tight', className)} {...props} />;
}

/**
 * @param {React.HTMLAttributes<HTMLParagraphElement>} props
 */
function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

/**
 * @param {React.HTMLAttributes<HTMLDivElement>} props
 */
function CardContent({ className, ...props }) {
  return <div className={cn('p-4 pt-0', className)} {...props} />;
}

/**
 * @param {React.HTMLAttributes<HTMLDivElement>} props
 */
function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center p-4 pt-0', className)} {...props} />;
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
