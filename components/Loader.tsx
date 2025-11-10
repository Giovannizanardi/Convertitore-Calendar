import React from 'react';

// Fix: Update component signature to accept standard SVG props to allow for customization.
export const Loader: React.FC<React.SVGProps<SVGSVGElement>> = ({ className, ...props }) => {
  const defaultClasses = "animate-spin h-10 w-10 text-primary";
  
  return (
    <svg 
      // Fix: Conditionally construct className. If a custom className is provided,
      // prepend the essential 'animate-spin' class to it. This allows overriding
      // size and color (as needed in EventPreviewTable) while preserving the animation.
      // If no className is passed, use the default classes.
      className={className ? `animate-spin ${className}` : defaultClasses} 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
      {...props}
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      ></circle>
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
};