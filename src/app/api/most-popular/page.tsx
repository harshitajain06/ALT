import sampleData from "@/data/sampleListings";

export default function MostPopular() {
  const sorted = [...sampleData].sort((a, b) => b.popularity_score - a.popularity_score);

  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-bold mb-4">Most Popular Services</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sorted.map((service) => (
          <div key={service.id} className="bg-[#07102a] p-4 rounded-xl border border-zinc-800">
            <h2 className="text-xl font-semibold">{service.name}</h2>
            <p className="text-pink-400">Bookings: {service.popularity_score}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
