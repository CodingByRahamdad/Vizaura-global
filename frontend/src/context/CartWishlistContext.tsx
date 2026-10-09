"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useMarket } from "@/context/MarketContext";
import { ApiError } from "@/lib/api";
import { addCartItem, clearCart as clearCartRequest, getCart, removeCartItem, updateCartItem } from "@/lib/api/cart";
import { addWishlistItem, getWishlist, removeWishlistItem } from "@/lib/api/wishlist";
import { CART_ERROR_MESSAGES } from "@/lib/types/cart";
import type { CartView } from "@/lib/types/cart";
import { WISHLIST_ERROR_MESSAGES } from "@/lib/types/wishlist";
import type { WishlistView } from "@/lib/types/wishlist";

interface CartWishlistState {
  cart: CartView | null;
  cartCount: number;
  isCartLoading: boolean;
  cartError: string | null;
  pendingKeys: Set<string>;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  wishlist: WishlistView | null;
  wishlistCount: number;
  wishlistProductIds: Set<string>;
  isWishlistLoading: boolean;
  wishlistError: string | null;
  /** Adds if not saved, removes if already saved — the heart button just checks wishlistProductIds. */
  toggleWishlist: (productId: string) => Promise<void>;
  refreshWishlist: () => Promise<void>;
}

const noop = async () => {};
const EMPTY_SET: Set<string> = new Set();

const CartWishlistContext = createContext<CartWishlistState>({
  cart: null,
  cartCount: 0,
  isCartLoading: false,
  cartError: null,
  pendingKeys: EMPTY_SET,
  addItem: noop,
  updateItem: noop,
  removeItem: noop,
  clearCart: noop,
  refreshCart: noop,
  wishlist: null,
  wishlistCount: 0,
  wishlistProductIds: EMPTY_SET,
  isWishlistLoading: false,
  wishlistError: null,
  toggleWishlist: noop,
  refreshWishlist: noop,
});

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return CART_ERROR_MESSAGES[error.code ?? ""] ?? WISHLIST_ERROR_MESSAGES[error.code ?? ""] ?? error.message;
  }
  return "Something went wrong. Please try again.";
}

export function CartWishlistProvider({ children }: { children: ReactNode }) {
  const { status, refreshSession } = useAuth();
  const { marketCode } = useMarket();
  const [cart, setCart] = useState<CartView | null>(null);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<WishlistView | null>(null);
  const [isWishlistLoading, setIsWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const cartRequestId = useRef(0);
  const wishlistRequestId = useRef(0);

  const withPending = useCallback(async (key: string, fn: () => Promise<void>) => {
    setPendingKeys((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const handleAuthFailure = useCallback(async () => {
    setCart(null);
    setWishlist(null);
    await refreshSession();
  }, [refreshSession]);

  // Returns a Promise rather than being declared async so that the state
  // updates below run inside .then()/.catch() callbacks, not synchronously in
  // the caller's own call stack — required so this can be invoked directly
  // from the effect below without tripping react-hooks/set-state-in-effect
  // (same reasoning as AuthContext's bootstrap effect).
  const refreshCart = useCallback((): Promise<void> => {
    const id = ++cartRequestId.current;
    return Promise.resolve()
      .then(() => {
        setIsCartLoading(true);
        setCartError(null);
        return getCart(marketCode);
      })
      .then((next) => {
        if (id === cartRequestId.current) setCart(next);
      })
      .catch(async (error: unknown) => {
        if (id !== cartRequestId.current) return;
        if (error instanceof ApiError && error.status === 401) {
          await handleAuthFailure();
          return;
        }
        setCartError(errorMessage(error));
      })
      .finally(() => {
        if (id === cartRequestId.current) setIsCartLoading(false);
      });
  }, [handleAuthFailure, marketCode]);

  const refreshWishlist = useCallback((): Promise<void> => {
    const id = ++wishlistRequestId.current;
    return Promise.resolve()
      .then(() => {
        setIsWishlistLoading(true);
        setWishlistError(null);
        return getWishlist();
      })
      .then((next) => {
        if (id === wishlistRequestId.current) setWishlist(next);
      })
      .catch(async (error: unknown) => {
        if (id !== wishlistRequestId.current) return;
        if (error instanceof ApiError && error.status === 401) {
          await handleAuthFailure();
          return;
        }
        setWishlistError(errorMessage(error));
      })
      .finally(() => {
        if (id === wishlistRequestId.current) setIsWishlistLoading(false);
      });
  }, [handleAuthFailure]);

  useEffect(() => {
    if (status === "authenticated") {
      void refreshCart();
      void refreshWishlist();
    } else if (status === "unauthenticated") {
      // Deferred (not called synchronously) for the same reason as
      // refreshCart/refreshWishlist above — avoids react-hooks/set-state-in-effect.
      void Promise.resolve().then(() => {
        setCart(null);
        setCartError(null);
        setWishlist(null);
        setWishlistError(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Cart (not Wishlist — market-independent by design) is re-fetched
  // whenever the active market changes, so switching markets shows that
  // market's own cart instead of continuing to display the previous one.
  useEffect(() => {
    if (status === "authenticated") void refreshCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketCode]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      await withPending(`add:${variantId}`, async () => {
        setCartError(null);
        try {
          setCart(await addCartItem(variantId, quantity, marketCode));
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await handleAuthFailure();
            return;
          }
          setCartError(errorMessage(error));
          throw error;
        }
      });
    },
    [withPending, handleAuthFailure, marketCode]
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      await withPending(`item:${itemId}`, async () => {
        setCartError(null);
        try {
          setCart(await updateCartItem(itemId, quantity, marketCode));
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await handleAuthFailure();
            return;
          }
          setCartError(errorMessage(error));
          throw error;
        }
      });
    },
    [withPending, handleAuthFailure, marketCode]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await withPending(`item:${itemId}`, async () => {
        setCartError(null);
        try {
          await removeCartItem(itemId, marketCode);
          await refreshCart();
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await handleAuthFailure();
            return;
          }
          setCartError(errorMessage(error));
          throw error;
        }
      });
    },
    [withPending, handleAuthFailure, refreshCart, marketCode]
  );

  const clearCart = useCallback(async () => {
    await withPending("clear", async () => {
      setCartError(null);
      try {
        await clearCartRequest(marketCode);
        await refreshCart();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await handleAuthFailure();
          return;
        }
        setCartError(errorMessage(error));
        throw error;
      }
    });
  }, [withPending, handleAuthFailure, refreshCart, marketCode]);

  const wishlistProductIds = useMemo(
    () => new Set(wishlist?.items.map((item) => item.productId) ?? []),
    [wishlist]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      await withPending(`wish:${productId}`, async () => {
        setWishlistError(null);
        const isSaved = wishlistProductIds.has(productId);
        try {
          if (isSaved) {
            await removeWishlistItem(productId);
            await refreshWishlist();
          } else {
            setWishlist(await addWishlistItem(productId));
          }
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await handleAuthFailure();
            return;
          }
          setWishlistError(errorMessage(error));
          throw error;
        }
      });
    },
    [withPending, handleAuthFailure, refreshWishlist, wishlistProductIds]
  );

  const value: CartWishlistState = {
    cart,
    cartCount: cart?.itemCount ?? 0,
    isCartLoading,
    cartError,
    pendingKeys,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    refreshCart,
    wishlist,
    wishlistCount: wishlist?.itemCount ?? 0,
    wishlistProductIds,
    isWishlistLoading,
    wishlistError,
    toggleWishlist,
    refreshWishlist,
  };

  return (
    <CartWishlistContext.Provider value={value}>
      {children}
    </CartWishlistContext.Provider>
  );
}

export function useCartWishlist() {
  return useContext(CartWishlistContext);
}
