import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    className = '',
    ...props
}) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-jewelry-gold focus:ring-offset-2 focus:ring-offset-jewelry-darker disabled:opacity-50 disabled:pointer-events-none';

    const variants = {
        primary: 'bg-jewelry-gold text-jewelry-darker hover:bg-jewelry-gold-hover',
        secondary: 'bg-jewelry-gray text-jewelry-light hover:bg-jewelry-gray/80',
        outline: 'border border-jewelry-gold text-jewelry-gold hover:bg-jewelry-gold hover:text-jewelry-darker',
        ghost: 'text-jewelry-light hover:bg-jewelry-gray hover:text-jewelry-gold',
        danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
    };

    const sizes = {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 py-2',
        lg: 'h-11 px-8 text-lg',
        icon: 'h-10 w-10'
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {children}
        </button>
    );
};

export default Button;
