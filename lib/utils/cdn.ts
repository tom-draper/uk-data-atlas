
export const withCDN = (path: string) => {
    if (process.env.NODE_ENV === 'production') {
        return `https://cdn.jsdelivr.net/gh/tom-draper/uk-data-atlas/public${path}`;
    }
    return path;
};