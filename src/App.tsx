import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { CategoryBlock } from "./components/CategoryBlock";
import { Summary } from "./components/Summary";
import { Toolbar } from "./components/Toolbar";
import { SubmitModal } from "./components/SubmitModal";
import {
  resolveProductWithFallback,
  computePerPersonTotals,
  loadState,
  saveState,
  PARTICIPANT_COLORS,
  buildExportFile,
  parseImportedState,
  extractProductUrlsFromText,
} from "./utils";
import type { Item, Participant, ByCategory } from "./types";

const DEFAULT_CATEGORIES = [
  "Aamupala",
  "Lounas & päivällinen",
  "Snacksit & makeat",
  "Juomat",
  "Alkoholi",
  "Sekalaiset",
];

const EXAMPLE_URLS = ["https://www.s-kaupat.fi/tuote/coop-omena-royal-gala/2003505600001"];

function defaultDeliveryDate(): string {
  return new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
}

function App() {
  const saved = loadState();

  const [participants, setParticipants] = useState<Participant[]>(
    saved?.participants || [
      { id: "p1", name: "Mikko", color: PARTICIPANT_COLORS[0] },
      { id: "p2", name: "Anna", color: PARTICIPANT_COLORS[1] },
      { id: "p3", name: "Jukka", color: PARTICIPANT_COLORS[2] },
      { id: "p4", name: "Saara", color: PARTICIPANT_COLORS[3] },
    ],
  );
  const [items, setItems] = useState<Item[]>(saved?.items || []);
  const [categories, setCategories] = useState<string[]>(saved?.categories || DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    saved?.categories?.[0] || DEFAULT_CATEGORIES[0],
  );
  const [busy, setBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  const [delivDate, setDelivDate] = useState<string>(() => saved?.delivery?.date || defaultDeliveryDate());

  const importInputRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const file = buildExportFile({
      participants,
      items,
      categories,
      delivery: { date: delivDate },
    });
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `mokkikauppalista-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportJsonChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setError(null);
    try {
      const text = await f.text();
      const next = parseImportedState(text);
      if (
        !confirm(
          "Korvataanko nykyinen kauppalista ja porukka tuodulla sisällöllä? Nykyinen data korvataan (localStorage päivittyy tallennuksella).",
        )
      ) {
        return;
      }
      setParticipants(next.participants);
      setItems(next.items);
      setCategories(next.categories);
      setDelivDate(next.delivery.date);
      setSelectedCategory(next.categories[0] || DEFAULT_CATEGORIES[0]);
    } catch (err) {
      setError((err as Error).message || "Tuonti epäonnistui");
    }
  };

  useEffect(() => {
    saveState({
      participants,
      items,
      categories,
      delivery: { date: delivDate },
    });
  }, [participants, items, categories, delivDate]);

  // Cleanup stale participant IDs from assignments when participant is deleted
  useEffect(() => {
    const ids = new Set(participants.map(p => p.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- strip orphan participant ids from assignments
    setItems(prev =>
      prev.map(it => {
        const cleanPeople = it.assignment.people.filter(p => ids.has(p));
        if (cleanPeople.length === it.assignment.people.length) return it;
        return { ...it, assignment: { ...it.assignment, people: cleanPeople } };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- participant count is intentional trigger
  }, [participants.length]);

  const defaultCategoryForNewItems = () =>
    categories.includes(selectedCategory) ? selectedCategory : categories[0] || "Sekalaiset";

  type Resolved = Awaited<ReturnType<typeof resolveProductWithFallback>>;

  const appendResolvedProduct = (url: string, p: Resolved, defaultCategory: string) => {
    setItems(prev => {
      const existing = prev.find(it => it.ean === p.ean && it.category === defaultCategory);
      if (existing) {
        return prev.map(it => (it.id === existing.id ? { ...it, qty: it.qty + 1 } : it));
      }
      const id = "it_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const newItem: Item = {
        id,
        ean: p.ean,
        name: p.name,
        brand: p.brand,
        unit: p.unit,
        price: p.price,
        image: p.image,
        url: url.includes("s-kaupat.fi")
          ? url
          : `https://www.s-kaupat.fi/tuote/${p.slug || "tuote"}/${p.ean}`,
        slug: p.slug,
        source: p.source,
        qty: 1,
        category: defaultCategory,
        comment: "",
        assignment: { shared: true, people: [] },
      };
      return [...prev, newItem];
    });
  };

  const addItem = async (url: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const p = await resolveProductWithFallback(url);
      appendResolvedProduct(url, p, defaultCategoryForNewItems());
      return true;
    } catch (e) {
      setError((e as Error).message || "Tuotteen lisäys epäonnistui");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addItemsFromInput = async (raw: string): Promise<boolean> => {
    const urls = extractProductUrlsFromText(raw);
    if (!urls.length) {
      setError("Ei kelvollisia S-kaupan tuotelinkkejä tai EAN-koodeja.");
      return false;
    }
    if (urls.length === 1) {
      return addItem(urls[0]!);
    }

    const cat = defaultCategoryForNewItems();
    setBusy(true);
    setBulkProgress({ current: 0, total: urls.length });
    setError(null);
    let okCount = 0;
    const failedLines: string[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]!;
      setBulkProgress({ current: i + 1, total: urls.length });
      try {
        const p = await resolveProductWithFallback(url);
        appendResolvedProduct(url, p, cat);
        okCount++;
      } catch (e) {
        failedLines.push(`${i + 1}. linkki: ${(e as Error).message}`);
      }
    }

    setBulkProgress(null);
    setBusy(false);

    if (failedLines.length > 0) {
      const tail = failedLines.length > 2 ? ` (+${failedLines.length - 2} muuta)` : "";
      setError(
        okCount > 0
          ? `Lisättiin ${okCount}/${urls.length} tuotetta. Virheet: ${failedLines.slice(0, 2).join(" ")}${tail}`
          : failedLines[0] || "Tuotteiden lisäys epäonnistui",
      );
    }

    return okCount > 0;
  };

  const updateItem = (id: string, patch: Partial<Item>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const addCategory = (name: string) => {
    if (!categories.includes(name)) setCategories([...categories, name]);
  };

  const renameCategory = (oldName: string, newName: string) => {
    if (!newName.trim()) return;
    setCategories(cats => cats.map(c => (c === oldName ? newName : c)));
    setItems(prev => prev.map(it => (it.category === oldName ? { ...it, category: newName } : it)));
  };

  const deleteCategory = (name: string) => {
    if (!confirm(`Poista kategoria "${name}"? Tuotteet siirtyvät kategoriaan "Sekalaiset".`))
      return;
    setCategories(cats => cats.filter(c => c !== name));
    setItems(prev =>
      prev.map(it => (it.category === name ? { ...it, category: "Sekalaiset" } : it)),
    );
    if (!categories.includes("Sekalaiset")) {
      setCategories(prev => [...prev.filter(c => c !== name), "Sekalaiset"]);
    }
  };

  const perPersonTotals = useMemo(
    () => computePerPersonTotals(items, participants),
    [items, participants],
  );

  const byCategory = useMemo<ByCategory>(() => {
    const out: ByCategory = {};
    for (const cat of categories) {
      const its = items.filter(it => it.category === cat);
      if (its.length) out[cat] = its;
    }
    const orphans = items.filter(it => !categories.includes(it.category));
    if (orphans.length) {
      out["Sekalaiset"] = (out["Sekalaiset"] || []).concat(orphans);
    }
    return out;
  }, [items, categories]);

  const total = items.reduce((s, it) => s + (it.price || 0) * it.qty, 0);

  return (
    <div className='app'>
      {/* Left: categories */}
      <aside className='col-left'>
        <div>
          <div className='eyebrow'>Kategoriat</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            {categories.map(c => {
              const n = items.filter(it => it.category === c).length;
              return (
                <div key={c} className='cat-list-row'>
                  <span>{c}</span>
                  <span className='mono' style={{ color: "var(--ink-3)", fontSize: 11 }}>
                    {n}
                  </span>
                  <button
                    className='cat-list-del'
                    title='Poista kategoria'
                    onClick={() => {
                      deleteCategory(c);
                      if (selectedCategory === c)
                        setSelectedCategory(categories.find(x => x !== c) || "Sekalaiset");
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button
              className='add-participant'
              style={{ marginTop: 6, padding: "6px 8px" }}
              onClick={() => {
                const n = prompt("Uuden kategorian nimi:");
                if (n && n.trim()) addCategory(n.trim());
              }}
            >
              <span className='plus' style={{ width: 22, height: 22, fontSize: 12 }}>
                +
              </span>
              <span>Uusi kategoria</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main: header, toolbar, product lists */}
      <main className='col-main'>
        <div className='main-h'>
          <h1>
            Mökkireissun <em>kauppalista</em>
          </h1>
        </div>

        <Toolbar
          onAdd={addItemsFromInput}
          busy={busy}
          busyDetail={bulkProgress ? `${bulkProgress.current}/${bulkProgress.total}` : null}
          error={error}
          clearError={() => setError(null)}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {items.length === 0 ? (
          <div className='empty'>
            <h3>Tyhjä kauppalista</h3>
            <p>
              Liitä yksi tai useampi S-kaupan tuotelinkki yläreunaan (useita rivejä tai pilkuilla
              erotettuna) ja paina Lisää. Voit valita kategorian, lisätä kommentin ja jakaa
              kustannuksen kenelle tahansa porukasta.
            </p>
            <div className='examples'>
              <div style={{ color: "var(--ink-3)", marginBottom: 4 }}>
                tai kokeile esimerkkilinkkejä:
              </div>
              {EXAMPLE_URLS.map(u => (
                <button key={u} onClick={() => addItemsFromInput(u)}>
                  {u.replace("https://www.", "")}
                </button>
              ))}
            </div>
          </div>
        ) : (
          Object.keys(byCategory).map(cat => (
            <CategoryBlock
              key={cat}
              name={cat}
              items={byCategory[cat]}
              participants={participants}
              allCategories={categories}
              isCustom={!DEFAULT_CATEGORIES.includes(cat)}
              onItemChange={updateItem}
              onItemDelete={deleteItem}
              onAddCategory={addCategory}
              onRenameCategory={n => renameCategory(cat, n)}
              onDeleteCategory={() => deleteCategory(cat)}
            />
          ))
        )}
      </main>

      {/* Right: summary */}
      <aside className='col-right'>
        <Summary
          items={items}
          participants={participants}
          setParticipants={setParticipants}
          perPersonTotals={perPersonTotals}
          onSubmit={() => setSubmitOpen(true)}
          onExportJson={exportJson}
          onImportJsonPick={() => importInputRef.current?.click()}
        />
      </aside>

      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        aria-hidden
        onChange={onImportJsonChange}
      />

      {submitOpen && (
        <SubmitModal
          items={items}
          participants={participants}
          byCategory={byCategory}
          total={total}
          onClose={() => setSubmitOpen(false)}
        />
      )}
    </div>
  );
}

export default App;

