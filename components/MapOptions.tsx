export default function MapOptions() {
    return (
        <div className="bg-[rgba(255,255,255,0.5)] text-sm rounded-md backdrop-blur-md shadow-lg border border-white/30">
            <div className="p-2.5 relative">
                <h2 className="font-semibold mb-2">Map Options</h2>
                <div className="flex items-center justify-between gap-2">
                    <div className="absolute flex flex-col top-3 right-3 flex-col border border-white/20 rounded-sm overflow-hidden bg-white/10 backdrop-blur-md shadow-sm">
                        <button className="px-2 py-0.5 text-sm hover:bg-white/20 transition-all duration-200 text-gray-500 font-semibold leading-none border-b border-gray-200/20 cursor-pointer">
                            +
                        </button>
                        <button className="px-2 py-0.5 text-sm hover:bg-white/20 transition-all duration-200 text-gray-500 font-semibold leading-none cursor-pointer">
                            −
                        </button>
                    </div>
                    <button className="border border-white/20 rounded-sm px-2 py-0.5 text-xs bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-200 shadow-sm text-gray-500 font-medium cursor-pointer">
                        Export
                    </button>
                </div>
            </div>
        </div>
    )
}