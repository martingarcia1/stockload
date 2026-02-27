import React, { forwardRef } from 'react';

const Input = forwardRef(({ className = '', label, error, ...props }, ref) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium leading-6 text-jewelry-light mb-1">
                    {label}
                </label>
            )}
            <input
                className={`flex h-10 w-full rounded-md border border-jewelry-gray bg-jewelry-darker px-3 py-2 text-sm text-jewelry-text ring-offset-jewelry-darker file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-jewelry-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jewelry-gold disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-red-500 focus-visible:ring-red-500' : ''
                    } ${className}`}
                ref={ref}
                {...props}
            />
            {error && (
                <p className="mt-1 text-sm text-red-500">{error}</p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
