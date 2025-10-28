
export default function TitlePane() {
    return (
        <div className="bg-[rgba(255,255,255,0.5)] text-sm rounded-md backdrop-blur-md shadow-lg border border-white/30">
            <div className="p-2.5 flex items-center bg-white/20">
                <img
                    src="/union-jack.png"
                    alt="UK Data Atlas Logo"
                    className="h-5 opacity-100 rounded mr-3 mt-0.5 transform scale-x-[-1] transition-all duration-1000 cursor-pointer"
                />
                <h1 className="font-semibold text-[16px]">UK Data Atlas</h1>
            </div>
        </div>
    )
}