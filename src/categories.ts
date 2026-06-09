export type CatKey = 'coffee' | 'food' | 'bar' | 'culture' | 'park' | 'shop'

export const CAT_STYLE: Record<CatKey, { dot: string; label: string }> = {
  coffee:  { dot: '#1ECCCF', label: 'Coffee' },
  food:    { dot: '#26A65B', label: 'Food' },
  bar:     { dot: '#7C6FFF', label: 'Bar' },
  culture: { dot: '#FF6B7A', label: 'Culture' },
  park:    { dot: '#FFBC00', label: 'Park' },
  shop:    { dot: '#D84C42', label: 'Shop' },
}

export const ALL_CATS: CatKey[] = ['coffee', 'food', 'bar', 'culture', 'park', 'shop']

const PATTERNS: { re: RegExp; cat: CatKey }[] = [
  { re: /coffee|caf[eé]|tea house|roaster|espresso/i, cat: 'coffee' },
  { re: /bar|pub|brewery|cocktail|tavern|nightclub|lounge|speakeasy|distillery|winery/i, cat: 'bar' },
  { re: /restaurant|pizza|burger|food|bakery|deli|diner|steakhouse|noodle|ramen|sushi|taco|bbq|grill|sandwich|breakfast|brunch|ice cream|dessert|gastropub|eatery/i, cat: 'food' },
  { re: /park|trail|garden|beach|forest|playground|plaza|square|waterfront|outdoors|recreation|stadium field|nature/i, cat: 'park' },
  { re: /museum|theater|theatre|cinema|movie|gallery|library|concert|opera|art|music venue|cultural|monument|landmark|historic|aquarium|zoo|planetarium|observatory/i, cat: 'culture' },
  { re: /shop|store|market|boutique|grocer|supermarket|bookstore|book store|mall|retail|salon|barber|pharmacy|electronics|clothing|gift|department/i, cat: 'shop' },
]

export function mapCategory(raw: string | null | undefined): CatKey {
  if (!raw) return 'shop'
  for (const { re, cat } of PATTERNS) {
    if (re.test(raw)) return cat
  }
  return 'shop'
}
