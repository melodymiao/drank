import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const input = searchParams.get("input")
  const sessiontoken = searchParams.get("sessiontoken") ?? ""

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json")
  url.searchParams.set("input", input)
  url.searchParams.set("types", "(cities)")
  url.searchParams.set("sessiontoken", sessiontoken)
  url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url.toString())
    const json = await res.json()

    // Return only the city name (main_text), not "City, State, Country"
    const predictions = (json.predictions || []).map(
      (p: { structured_formatting: { main_text: string } }) =>
        p.structured_formatting.main_text
    )

    return NextResponse.json({ predictions })
  } catch {
    return NextResponse.json({ predictions: [] }, { status: 500 })
  }
}