
export default function Navigation() {
    return (
        <nav>
            <div className="flex py-6 px-4 w-[65%] mx-auto">
                <div className="crop">
                    <img src="/union-jack.png" alt="UK Data Atlas Logo" className="h-[24px] opacity-100 rounded grayscale-100 mr-3 content-center mt-[2px] transform scale-x-[-1] hover:grayscale-0 transition-all duration-1000" />
                </div>
                <h1 className="font-semibold text-xl w-[200px]">UK Data Atlas</h1>
                <div className="flex place-items-center flex-grow text-[#4e4e4e]">
                    <div className="ml-auto flex-grow text-right">
                        <a href="/" className="px-4 content-center cursor-pointer hover:underline">Home</a>
                        <a href="/" className="px-4 content-center cursor-pointer hover:underline">Demo</a>
                        <a href="/" className="px-4 content-center cursor-pointer hover:underline">Pricing</a>
                        <a href="/" className="px-4 content-center cursor-pointer hover:underline">About</a>
                    </div>
                    <div className="text-right">
                        <a href="/" className="px-4 text-md content-center cursor-pointer  hover:underline">Sign-In</a>
                    </div>
                </div>
            </div>
        </nav>
    )
}