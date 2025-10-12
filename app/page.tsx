import Navigation from "../components/Navigation";

export default function Home() {
  return (
    <div style={{ backgroundImage: 'url(/map-background.png)', backgroundSize: 'cover', minHeight: '100vh' }}>
      <Navigation />

      <div className="pt-[25vh] px-[16%]">
        <div className="p-5">
          <h1 className="text-5xl font-semibold">UK Data Atlas</h1>
          <div className="mt-[10px]">
            <p>The powerful mapping tool for visualizing data that shapes the United Kingdom.</p>
          </div>

          <div className="pt-12 flex">
            <a className="bg-black text-white px-6 py-3 rounded-md hover:opacity-80 cursor-pointer" href="/atlas">
              Get Started
            </a>
          <a className="text-[#4e4e4e] pt-0 my-auto pl-8 hover:underline cursor-pointer" href="/atlas?demo=true">
            Or try the demo
          </a>
          </div>
        </div>
      </div>
    </div>

  );
}
