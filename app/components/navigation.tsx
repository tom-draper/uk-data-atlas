
export default function Navigation() {
    return (
        <nav>
            <div className="flex py-6 px-4 w-[65%] mx-auto">
                <h1 className="font-semibold text-xl w-[200px]">UK Data Atlas</h1>
                <div className="flex place-items-center flex-grow">
                    <div className="ml-auto flex-grow text-right">
                        <a href="/" className="px-4 content-center">Home</a>
                        <a href="/" className="px-4 content-center">Demo</a>
                        <a href="/" className="px-4 content-center">Pricing</a>
                        <a href="/" className="px-4 content-center">About</a>
                    </div>
                    <div className="text-right">
                        <a href="/" className="px-4 text-md content-center">Sign-In</a>
                    </div>
                </div>
            </div>
        </nav>
    )
}