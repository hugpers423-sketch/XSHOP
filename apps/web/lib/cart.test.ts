// apps/web/lib/cart.test.ts
// Unit tests — store del carrito (Zustand)

import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore, type CartItem } from './cart';

const base: Omit<CartItem, 'quantity'> = {
  id: '',
  productId: 'p1',
  title: 'Producto 1',
  price: 100,
  seller: 'Tienda X',
  image: '/img/p1.jpg',
};

function reset() {
  useCartStore.setState({ items: [] });
}

describe('useCartStore', () => {
  beforeEach(reset);

  it('agrega un item nuevo con cantidad 1', () => {
    useCartStore.getState().addItem({ ...base, productId: 'p1' });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it('incrementa cantidad si el producto ya existe', () => {
    const st = useCartStore.getState();
    st.addItem({ ...base, productId: 'p1' });
    st.addItem({ ...base, productId: 'p1' }, 2);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it('trata variantes como items distintos', () => {
    const st = useCartStore.getState();
    st.addItem({ ...base, productId: 'p1', variantId: 'v-rojo' });
    st.addItem({ ...base, productId: 'p1', variantId: 'v-azul' });
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it('actualiza cantidad con delta y elimina en 0', () => {
    const st = useCartStore.getState();
    st.addItem({ ...base, productId: 'p1' }, 2);
    const id = useCartStore.getState().items[0].id;

    useCartStore.getState().updateQuantity(id, -1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);

    useCartStore.getState().updateQuantity(id, -1);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('elimina por id', () => {
    const st = useCartStore.getState();
    st.addItem({ ...base, productId: 'p1' });
    const id = useCartStore.getState().items[0].id;
    useCartStore.getState().removeItem(id);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('calcula subtotal correcto', () => {
    const st = useCartStore.getState();
    st.addItem({ ...base, productId: 'p1', price: 100 }, 2);
    st.addItem({ ...base, productId: 'p2', price: 50 }, 1);
    expect(useCartStore.getState().subtotal()).toBe(250);
  });

  it('clear vacía el carrito', () => {
    useCartStore.getState().addItem({ ...base, productId: 'p1' });
    useCartStore.getState().clear();
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().subtotal()).toBe(0);
  });
});
