// components/Navigation.tsx

export default function Navigation() {
    return (
        <nav>
            <div className="flex py-6 px-4 w-[65%] mx-auto">
                <h1 className="text-xl w-50 font-semibold">UK Data Atlas</h1>
                <div className="flex place-items-center grow text-[#4e4e4e]">
                    <div className="ml-auto grow text-right">
                        <a href="/" className="px-4 content-center cursor-pointer hover:underline">Home</a>
                        {/* <a href="/" className="px-4 content-center cursor-pointer hover:underline">Demo</a> */}
                        {/* <a href="/" className="px-4 content-center cursor-pointer hover:underline">Pricing</a> */}
                        <a href="/sources" className="px-4 content-center cursor-pointer hover:underline">Sources</a>
                        <a href="/" className="px-4 content-center cursor-pointer hover:underline">About</a>
                    </div>
                    {/* <div className="text-right">
                        <a href="/" className="px-4 text-md content-center cursor-pointer  hover:underline">Sign-In</a>
                    </div> */}
                </div>
            </div>
        </nav>
    )
}