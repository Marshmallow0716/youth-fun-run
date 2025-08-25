import logo from "/youth-home-rizal-logo.png";

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center px-6">
      {/* Logo */}
      <img src={logo} alt="Youth Fun Run Logo" className="w-24 h-24 mb-4" />

      {/* Header / Event Name */}
      <h1 className="text-5xl font-extrabold text-red-600 mb-4">
        Youth Fun Run 2025
      </h1>
      <p className="text-lg text-gray-700 mb-8">
        Join us for an exciting community run promoting health, unity, and fun!
      </p>

      {/* Call to Action */}
      <button className="bg-red-600 text-white px-6 py-3 rounded-2xl text-lg font-semibold shadow-lg hover:bg-red-700 transition">
        Register Now
      </button>
    </div>
  );
}

export default App;
