import packageJson from '../package.json';


export default function TitlePane() {
    const version = packageJson.version;

    return (
        <div className="bg-[rgba(255,255,255,0.5)] text-sm rounded-md backdrop-blur-md shadow-lg border border-white/30 relative">
            <div className="flex items-center bg-white/20 rounded-t-md">
                <img
                    src="/union-jack.png"
                    alt="UK Data Atlas Logo"
                    className="h-9 opacity-50 -m-px mr-3 rounded-r-md transform scale-x-[-1] cursor-pointer"
                    style={{
                        filter: "contrast(0.2) grayscale(1) brightness(1.8)"
                    }}
                />
                <h1 className="font-semibold text-[15px]">UK Data Atlas</h1>
                <span className="text-xs text-gray-400/60 text-gray-500 font-mono ml-auto mr-5 select-none mt-0.5">
                    v{version}
                </span>
            </div>
        </div>
    );
}