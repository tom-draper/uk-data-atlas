import Navigation from "./components/navigation";

export default function Home() {
  return (
    <div>
      <Navigation />

      <div className="pt-[25vh] px-[15%]">
        <div className="p-5">
          {/* <div>
            <img src="/union-flag.png" alt="UK Data Atlas Logo" className="mb-6 h-[60px] opacity-50" />
          </div> */}
          <h1 className="text-5xl font-semibold">UK Data Atlas</h1>
          <div className="mt-[10px]">
            <p>The most powerful mapping tool for visualizing data that shapes the United Kingdom.</p>
          </div>

          <div className="pt-12 flex">
            <button className="bg-black text-white px-6 py-3 rounded-md hover:opacity-80 cursor-pointer">
              Get Started
            </button>
          <div className="text-[#4e4e4e] pt-0 my-auto pl-8 hover:underline cursor-pointer">
            Or try the demo
          </div>
          </div>
        </div>
      </div>
    </div>

  );
}
