# Ruokatilaus (paikallinen)

React-sovellus ruokatilauksen suunnitteluun: osallistujat, kategoriat ja S-kaupat.fi -tuotteet (GraphQL-proxy paikallisessa palvelimessa). Tila tallennetaan selaimeen.

## Vaatimukset

- Node.js (npm)

## Asennus

```bash
npm install
```

## Ympäristömuuttujat

Kopioi esimerkki ja täydennä tarvittaessa:

```bash
cp .env.local.example .env.local
```

- **SKAUPAT_BEARER_TOKEN** — valinnainen. Tarvitaan mm. ostoslistojen luontiin tilillesi. Anonyymit kyselyt (kori, osoite, noutoajat) toimivat ilman tokenia. Katso tarkemmat ohjeet `.env.local.example`-tiedostosta. Tämän voi asettaa myös sovelluksessa.
- **SKAUPAT_COOKIES** — valinnainen, jos jotkin pyynnöt palauttavat 403.
- **PORT** — Express-proxyn portti kehityksessä (oletus `5179`).
- **NO_OPEN** — aseta `1`, jos et halua selaimen avautuvan automaattisesti `npm start` -komennolla.

## Kehitys

Käynnistää Express-proxyn (`127.0.0.1:5179`) ja Viten (`127.0.0.1:5173`). Selain: Viten osoite; API-kutsut proxataan palvelimelle.

```bash
npm run dev
```

## Tuotantorakenne

```bash
npm run build
npm start
```

Palvelin (`npm start`) kuuntelee oletuksena porttia `5179`, tarjoilee rakennetun frontendin `dist/`-kansiosta ja avaa selaimen, ellei `NO_OPEN=1`.

## Muut skriptit

| Komento                | Kuvaus                                     |
| ---------------------- | ------------------------------------------ |
| `npm run dev:server`   | Vain Express (tsx watch)                   |
| `npm run dev:client`   | Vain Vite                                  |
| `npm run build:client` | TypeScript + Vite build                    |
| `npm run build:server` | Palvelimen TypeScript build `server/dist/` |
| `npm run lint`         | ESLint                                     |

## Huomioita

- Bearer-token vanhenee tyypillisesti noin tunnissa; 401 → kopioi uusi token selaimesta (ohje `.env.local.example`).
- Tämä repo on henkilökohtaiseen / paikalliseen käyttöön; noudata S-kaupat.fi -palvelun käyttöehtoja.

