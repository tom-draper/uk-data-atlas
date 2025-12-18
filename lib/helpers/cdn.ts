
export const withCDN = (path: string) => {
    if (process.env.NODE_ENV === 'production') {
        return `https://cdn.jsdelivr.net/gh/tom-draper/uk-data-atlas@main/public${path}`;
    }
    return path;
};