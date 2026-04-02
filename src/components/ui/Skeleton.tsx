import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div 
      className={cn(
        "bg-surface-container-highest/50 rounded-md animate-skeleton",
        className
      )} 
    />
  );
};
