import { useState } from "react";
import { fmtPrice, createShoppingListWithProducts } from "../utils";
import type { ByCategory, Item, Participant } from "../types";

type Props = {
  items: Item[];
  participants: Participant[];
  byCategory: ByCategory;
  total: number;
  onClose: () => void;
};

export function SubmitModal({ items, participants, byCategory, total, onClose }: Props) {
  const [orderState, setOrderState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [orderError, setOrderError] = useState<string | null>(null);

  const handleOrder = async () => {
    setOrderState("loading");
    setOrderError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const list = await createShoppingListWithProducts({
        name: `Mökkireissun kauppalista ${today}`,
        items,
      });
      setOrderState("done");
      window.open(`https://www.s-kaupat.fi/ostoslistat/${list.id}`, "_blank");
    } catch (e) {
      setOrderError((e as Error).message);
      setOrderState("error");
    }
  };

  return (
    <div className='modal-bg' onClick={onClose}>
      <div className='modal' onClick={e => e.stopPropagation()}>
        <div className='modal-h'>
          <div>
            <h2>Valmis tilaus</h2>
            <div className='muted' style={{ fontSize: 13, marginTop: 6 }}>
              Yhteensä <strong>{fmtPrice(total)}</strong> ·{" "}
              {items.reduce((s, it) => s + it.qty, 0)} tuotetta · {participants.length} hlö
            </div>
          </div>
          <button className='x' onClick={onClose}>
            ×
          </button>
        </div>

        <div className='modal-body'>
          {Object.keys(byCategory).map(cat => (
            <div key={cat}>
              <div className='receipt-cat'>{cat}</div>
              {byCategory[cat].map(it => (
                <div key={it.id} className='receipt-line'>
                  <span className='nm'>{it.name}</span>
                  <span className='qty-x'>× {it.qty}</span>
                  <span className='amt'>{fmtPrice((it.price || 0) * it.qty)}</span>
                </div>
              ))}
            </div>
          ))}

          {orderState === "done" && (
            <div className='toast info' style={{ marginTop: 18 }}>
              <div>
                Ostoslista luotu S-kauppaan ja avattu uuteen välilehteen.
                Paina siellä <strong>Lisää koriin</strong>, niin kaikki tuotteet siirtyvät
                ostoskoriin kerralla. Valitse kauppa ja toimitusaika S-kaupan puolella.
              </div>
            </div>
          )}

          {orderState === "error" && (
            <div className='toast err' style={{ marginTop: 18 }}>
              <div>
                <strong>Virhe:</strong> {orderError}
              </div>
            </div>
          )}
        </div>

        <div className='modal-foot'>
          <button className='btn' onClick={onClose}>
            Sulje
          </button>
          <button
            className='btn green'
            onClick={handleOrder}
            disabled={orderState === "loading" || orderState === "done"}
          >
            {orderState === "loading" && (
              <>
                <span className='spin' style={{ marginRight: 8 }} />
                Luodaan…
              </>
            )}
            {orderState === "idle" && <>Luo ostoslista S-kauppaan →</>}
            {orderState === "done" && <>✓ Ostoslista luotu</>}
            {orderState === "error" && <>Yritä uudelleen</>}
          </button>
        </div>
      </div>
    </div>
  );
}
