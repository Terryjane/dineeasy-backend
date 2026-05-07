const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ── Waiters ─────────────────────────────────────────
let waiters = [
  { id: 1, name: 'James', status: 'available' },
  { id: 2, name: 'Mary', status: 'available' },
  { id: 3, name: 'Peter', status: 'available' },
  { id: 4, name: 'Grace', status: 'available' },
  { id: 5, name: 'David', status: 'available' },
];

// ── Menu ────────────────────────────────────────────
const menuItems = [
  {    id: 1,
    name: 'Nyama Choma',
    price: 650,
    category: 'Mains',
    description: 'Grilled beef served with kachumbari and ugali',
    available: true,
    emoji: '🥩',
    recipe: [
      { ingredientId: 1, qty: 0.5, unit: 'kg' }, // Beef
      { ingredientId: 4, qty: 50, unit: 'g' }     // Salt
    ]
  },

  {
    id: 2,
    name: 'Tilapia Fish',
    price: 550,
    category: 'Mains',
    description: 'Whole fried tilapia with ugali and sukuma wiki',
    available: true,
    emoji: '🐟',
    recipe: [
      { ingredientId: 2, qty: 1, unit: 'pcs' } // Fish
    ]
  },
  { id: 3, name: 'Chicken Biryani', price: 480, category: 'Mains', description: 'Aromatic rice with tender chicken and spices', available: true, emoji: '🍛' },
  { id: 4, name: 'Ugali & Sukuma', price: 150, category: 'Mains', description: 'Classic ugali with stewed sukuma wiki', available: true, emoji: '🌿' },
  { id: 5, name: 'Beef Stew', price: 300, category: 'Mains', description: 'Slow-cooked beef stew with chapati', available: true, emoji: '🍲' },
  { id: 6, name: 'Chapati', price: 50, category: 'Sides', description: 'Freshly made soft chapati (per piece)', available: true, emoji: '🫓' },
  { id: 7, name: 'Kachumbari Salad', price: 80, category: 'Sides', description: 'Fresh tomato and onion salad with lemon', available: true, emoji: '🥗' },
 {
    id: 8,
    name: 'Chips (Fries)',
    price: 120,
    category: 'Sides',
    description: 'Crispy golden fries with ketchup',
    available: true,
    emoji: '🍟',
    recipe: [
      { ingredientId: 5, qty: 0.3, unit: 'kg' }, // Potatoes
      { ingredientId: 6, qty: 0.05, unit: 'liters' } // Oil
    ]
  },
  { id: 9, name: 'Mandazi', price: 30, category: 'Snacks', description: 'Sweet fried dough, 3 pieces', available: true, emoji: '🍩' },
  { id: 10, name: 'Samosa', price: 40, category: 'Snacks', description: 'Crispy pastry filled with spiced minced meat', available: true, emoji: '🥟' },
  { id: 11, name: 'Fresh Juice', price: 120, category: 'Drinks', description: 'Freshly squeezed mango, passion, or orange', available: true, emoji: '🥤' },
  { id: 12, name: 'Chai (Tea)', price: 60, category: 'Drinks', description: 'Hot Kenyan masala tea with milk', available: true, emoji: '☕' },
  { id: 13, name: 'Soda', price: 80, category: 'Drinks', description: 'Coca-Cola, Fanta, Sprite (300ml)', available: true, emoji: '🥃' },
  { id: 14, name: 'Water', price: 50, category: 'Drinks', description: 'Chilled bottled water (500ml)', available: true, emoji: '💧' },
];

const tables = [
  { id: 1, number: 'Table 1' },
  { id: 2, number: 'Table 2' },
  { id: 3, number: 'Table 3' },
  { id: 4, number: 'Table 4' },
  { id: 5, number: 'Table 5' },
];

let orders = [];
let ratings = [];

// ── Inventory ─────────────────────────────────────────
let inventory = [
  { id: 1, name: 'Beef', quantity: 20, unit: 'kg' },
  { id: 2, name: 'Tilapia', quantity: 15, unit: 'pcs' },
  { id: 4, name: 'Salt', quantity: 2000, unit: 'g' },
  { id: 5, name: 'Potatoes', quantity: 30, unit: 'kg' },
  { id: 6, name: 'Cooking Oil', quantity: 10, unit: 'liters' }
];

let preparedStock = [
  { id: 1, name: 'Nyama Choma Plate', quantity: 10, unit: 'kg' },
  { id: 2, name: 'Tilapia Plate', quantity: 8, unit: 'pcs' },
  { id: 3, name: 'Chips Serving', quantity: 15, unit: 'pcs' }
];

function deductStock(items) {
  items.forEach(orderItem => {

    const menuItem = menuItems.find(m => m.id === orderItem.id);
    if (!menuItem) return;

    // 🟡 CASE 1: Prepared food deduction
    if (menuItem.usesPrepared) {
      const prepared = preparedStock.find(p => p.id === menuItem.preparedId);

      if (prepared) {
        prepared.quantity -= orderItem.qty;

        if (prepared.quantity < 0) {
          prepared.quantity = 0;
        }
      }
    }

    // 🔵 CASE 2: Raw ingredients deduction
    if (menuItem.recipe) {
      menuItem.recipe.forEach(r => {
        const ing = inventory.find(i => i.id === r.ingredientId);

        if (ing) {
          ing.quantity -= r.qty * orderItem.qty;

          if (ing.quantity < 0) {
            ing.quantity = 0;
          }
        }
      });
    }

  });
}

function updateAvailability() {

  menuItems.forEach(item => {

    // 🟡 CASE 1: Prepared food items
    if (item.usesPrepared) {
      const prepared = preparedStock.find(p => p.id === item.preparedId);

      item.available = prepared && prepared.quantity > 0;
    }

    // 🔵 CASE 2: Raw ingredient based items
    if (item.recipe) {
      item.available = item.recipe.every(r => {
        const stock = inventory.find(i => i.id === r.ingredientId);

        if (!stock) return false;

        return stock.quantity >= r.qty;
      });
    }

  });

}
// ── ROUTES ───────────────────────────────────────────

// Menu
app.get('/api/menu', (req, res) => {
  updateAvailability(); // always recalculate before sending
  res.json(menuItems);
});
// Orders
app.get('/api/orders', (req, res) => res.json(orders));

// 🔥 PLACE ORDER + WAITER ASSIGNMENT
app.post('/api/orders', (req, res) => {
  const { tableId, tableNumber, items, total, paymentMethod } = req.body;

deductStock(items);
updateAvailability(); // 🔥 IMPORTANT
  let assignedWaiter = waiters.find(w => w.status === 'available');

  if (assignedWaiter) {
    assignedWaiter.status = 'busy';
  }

  const order = {
    id: uuidv4(),
    orderNumber: `ORD-${Date.now().toString().slice(-4)}`,
    tableId,
    tableNumber,
    items,
    total,
    paymentMethod,
    waiter: assignedWaiter ? assignedWaiter.name : null,
    status: 'received',
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  deductInventory(items);

  io.emit('new_order', order);

  res.json({
    ...order,
    message: assignedWaiter
      ? `Waiter ${assignedWaiter.name} will serve you shortly`
      : "Order placed, waiter will be assigned soon"
  });
});

// 🔥 UPDATE ORDER STATUS (FREE WAITER)
app.patch('/api/orders/:id/status', (req, res) => {
  const { status } = req.body;

  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = status;

  if (status === 'completed' && order.waiter) {
    const waiter = waiters.find(w => w.name === order.waiter);
    if (waiter) waiter.status = 'available';
  }

  io.emit('order_updated', order);

  res.json(order);
});

// Inventory
app.get('/api/inventory', (req, res) => res.json(inventory));

// QR
app.get('/api/qr/:tableId', async (req, res) => {
 const url = `http://10.32.7.254:5173/menu?table=${req.params.tableId}`;
  const qr = await QRCode.toDataURL(url);
  res.json({ qr });
});

// Socket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});