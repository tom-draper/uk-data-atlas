
export default function TitlePane() {
    return (
        <div className="bg-[rgba(255,255,255,0.6)] text-sm rounded-md backdrop-blur-md shadow-lg">
            <div className="p-[10px] border-b border-gray-200 flex items-center">
                <img
                    src="/union-jack.png"
                    alt="UK Data Atlas Logo"
                    className="h-[24px] opacity-100 rounded grayscale-0 mr-3 mt-[2px] transform scale-x-[-1] hover:grayscale-0 transition-all duration-1000 cursor-pointer"
                />
                <h1 className="font-semibold text-lg">UK Data Atlas</h1>
            </div>
        </div>
    )
}