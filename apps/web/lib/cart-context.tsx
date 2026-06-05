"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  price: string;
  currency: string;
  supplierId: string;
  supplierName: string;
  imageUrl: string | null;
  qty: number;
}

export interface CartProduct {
  id: string;
  sku: string;
  name: string;
  price: string;
  currency: string;
  supplierId: string;
  supplier?: { name: string } | null;
  imageUrl: string | null;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  add: (product: CartProduct) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CART_KEY = "7bs_cart";
const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    window.localStorage.setItem(CART_KEY, JSON.stringify(next));
  }, []);

  const add = useCallback(
    (p: CartProduct) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === p.id);
        const next = existing
          ? prev.map((i) =>
              i.productId === p.id ? { ...i, qty: i.qty + 1 } : i,
            )
          : [
              ...prev,
              {
                productId: p.id,
                sku: p.sku,
                name: p.name,
                price: p.price,
                currency: p.currency,
                supplierId: p.supplierId,
                supplierName: p.supplier?.name ?? "Поставщик",
                imageUrl: p.imageUrl,
                qty: 1,
              },
            ];
        window.localStorage.setItem(CART_KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  const setQty = useCallback(
    (productId: string, qty: number) => {
      persist(
        items.map((i) =>
          i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i,
        ),
      );
    },
    [items, persist],
  );

  const remove = useCallback(
    (productId: string) => {
      persist(items.filter((i) => i.productId !== productId));
    },
    [items, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  return (
    <CartContext.Provider value={{ items, count, add, setQty, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
