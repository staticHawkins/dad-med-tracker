export function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export async function fetchDrugSuggestions(query, signal) {
  if (query.trim().length < 2) return []
  try {
    const url = `https://api.fda.gov/drug/ndc.json?search=generic_name:${encodeURIComponent(query)}*&limit=50`
    const res = await fetch(url, { signal })
    if (res.status === 404) return []
    if (!res.ok) return []
    const data = await res.json()
    const q = query.trim().toLowerCase()
    const seen = new Set()
    return (data.results || [])
      .filter(r => r.generic_name && r.generic_name.toLowerCase().startsWith(q))
      .reduce((acc, r) => {
      const g = toTitleCase(r.generic_name || '')
      if (!g || seen.has(g)) return acc
      seen.add(g)
      const rawBrand = toTitleCase(r.brand_name || '')
      const brand = rawBrand && rawBrand.toUpperCase() !== 'N/A' && rawBrand.toLowerCase() !== g.toLowerCase()
        ? rawBrand
        : ''
      acc.push({ genericName: g, brandName: brand })
      return acc
    }, []).slice(0, 8)
  } catch {
    return []
  }
}
