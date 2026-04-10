import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json")
  url.searchParams.set("query", query)
  url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url.toString())
    const json = await res.json()

    // Extract city names from each result's address_components
    const cities: string[] = []
    for (const place of json.results || []) {
      const components: { types: string[]; long_name: string }[] =
        place.address_components || []
      const locality = components.find((c) => c.types.includes("locality"))
      const city = locality?.long_name
      if (city && !cities.includes(city)) {
        cities.push(city)
      }
      if (cities.length >= 5) break
    }

    return NextResponse.json({ results: cities })
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}