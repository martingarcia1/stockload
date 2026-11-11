// Estilos oscuros/dorados para react-select, compartidos por los formularios.
export const selectStyles = {
    control: (base, state) => ({
        ...base,
        backgroundColor: '#09090b',
        borderColor: state.isFocused ? '#cca35e' : '#27272a',
        color: '#fafafa',
        padding: '2px',
        '&:hover': { borderColor: '#cca35e' },
        boxShadow: state.isFocused ? '0 0 0 1px #cca35e' : 'none'
    }),
    menu: (base) => ({ ...base, backgroundColor: '#18181b', border: '1px solid #27272a', zIndex: 50 }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? '#cca35e' : (state.isFocused ? '#27272a' : '#18181b'),
        color: state.isSelected ? '#09090b' : '#fafafa',
        '&:active': { backgroundColor: '#cca35e', color: '#09090b' }
    }),
    singleValue: (base) => ({ ...base, color: '#fafafa' }),
    input: (base) => ({ ...base, color: '#fafafa' }),
    placeholder: (base) => ({ ...base, color: '#a1a1aa' })
};

export const fieldClass =
    'w-full h-10 bg-jewelry-darker border border-jewelry-gray rounded-md text-sm text-jewelry-light px-3 focus:outline-none focus:border-jewelry-gold focus:ring-1 focus:ring-jewelry-gold disabled:opacity-50';

export const labelClass = 'block text-xs font-medium uppercase tracking-wide text-jewelry-light/60 mb-1.5';
