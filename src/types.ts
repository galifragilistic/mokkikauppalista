export type Participant = {
  id: string
  name: string
  color: string
}

export type Assignment = {
  shared: boolean
  people: string[]
}

export type Item = {
  id: string
  ean: string
  name: string
  brand: string | null
  unit: string | null
  price: number | null
  image: string | null
  url: string
  slug: string
  source: 'api' | 'fallback'
  qty: number
  category: string
  comment: string
  assignment: Assignment
}

export type Delivery = {
  date: string
}

export type AppState = {
  participants: Participant[]
  items: Item[]
  categories: string[]
  delivery: Delivery
}

/** JSON-tiedosto, jonka Vie tuottaa ja Tuo osaa lukea. */
export const RUOKATILAUS_EXPORT_FORMAT = 'ruokatilaus-export' as const

export type RuokatilausExportFileV1 = {
  format: typeof RUOKATILAUS_EXPORT_FORMAT
  version: 1
  exportedAt: string
  data: AppState
}

export type PerPersonTotals = Record<string, number>
export type ByCategory = Record<string, Item[]>

export type AddressSuggestion = {
  id: string
  title: string
  city: string
  streetAddress: string
  latitude: number
  longitude: number
  resultType: string
}

export type PickupSlotItem = {
  id: string
  price: number
  closingTime: string
  deliveryTimeStart: string
  deliveryTimeEnd: string
  isAlcoholSellingAllowed: boolean
}

export type SlotsInPickupPoint = {
  store: { id: string; brand: string }
  pickupPoint: { id: string; name: string; address: { street: string; city: string; postalCode: string } }
  slots: PickupSlotItem[]
}

export type SelectedSlot = {
  storeId: string
  areaId: string
  slotId: string
  storeName: string
  slotTime: string
  price: number
}
