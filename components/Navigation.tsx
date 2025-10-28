// components/LocationPanel.tsx
export default function Navigation() {
    return (
        <nav>
            <div className="flex py-6 px-4 w-[65%] mx-auto">
                {/* <img src="/uk-background.png" alt="UK Data Atlas Logo" className="h-[24px] opacity-100 rounded grayscale-0 mr-3 content-center mt-[2px] hover:grayscale-0 transition-all duration-1000 cursor-pointer" /> */}
                <h1 className="font-semibold text-xl w-[200px]">UK Data Atlas</h1>
                <div className="flex place-items-center grow text-[#4e4e4e]">
                    <div className="ml-auto grow text-right">
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