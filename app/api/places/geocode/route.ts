import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const latlng = searchParams.get("latlng")

  if (!latlng) {
    return NextResponse.json({ error: "Missing latlng" }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
  url.searchParams.set("latlng", latlng)
  url.searchParams.set("result_type", "locality")
  url.searchParams.set("key", apiKey)

  try {
    const res = await fetch(url.toString())
    const json = await res.json()
    return NextResponse.json(json)
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}