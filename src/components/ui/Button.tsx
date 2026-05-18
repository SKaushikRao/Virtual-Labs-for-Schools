import React from 'react';
import { cn } from '../../utils/cn';

export function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled = false
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'accent' | 'glass';
  className?: string;
  disabled?: boolean;
}) {
  const baseStyles = "relative px-6 py-3 rounded-full font-display font-medium tracking-wide transition-all duration-300 ease-out overflow-hidden group";
  
  const variants = {
    primary: "bg-[#4e44ff] hover:bg-[#3d33e6] text-white shadow-[0_0_20px_rgba(78,68,255,0.4)]",
    secondary: "bg-transparent border border-white/20 hover:bg-white/10 text-white",
    accent: "bg-gradient-to-r from-[#4e44ff] to-[#00f2ff] text-white hover:shadow-[0_0_30px_rgba(0,242,255,0.5)]",
    glass: "glass-panel hover:bg-white/10 text-white"
  };

  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} className={cn(baseStyles, variants[variant], className, disabled ? 'opacity-50 cursor-not-allowed' : '')}>
      <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out z-0 mix-blend-overlay"></div>
      <span className="relative z-10">{children}</span>
    </button>
  );
}
