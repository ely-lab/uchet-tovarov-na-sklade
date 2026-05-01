const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const USERS = [
  { username: 'admin', password: '12345', role: 'head_office', warehouse: 'all' },
  { username: 'jalalabad', password: '0304', role: 'branch', warehouse: 'Жалал-Абад' },
  { username: 'bishkek', password: '0000', role: 'branch', warehouse: 'Бишкек' },
  { username: 'osh', password: '0302', role: 'branch', warehouse: 'Ош' },
  { username: 'balykchi', password: '0305', role: 'branch', warehouse: 'Балыкчи' },
  { username: 'karakol', password: '0306', role: 'branch', warehouse: 'Каракол' },
  { username: 'osh_market', password: '0308', role: 'branch', warehouse: 'Ошский рынок' },
  { username: 'talas', password: '0309', role: 'branch', warehouse: 'Талас' }
];


// 📦 Загрузка базы
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ items: [], history: [] }, null, 2));
  }

  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDB();
const sessions = new Map();


// 🧠 История
function addHistory(entry) {
  db.history = db.history || [];

  db.history.push({
    id: Date.now(),
    ...entry,
    date: new Date().toISOString()
  });

  saveDB(db);
}


// 🔐 LOGIN
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const user = USERS.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const safeUser = {
    username: user.username,
    role: user.role,
    warehouse: user.warehouse
  };

  sessions.set(token, safeUser);
  res.json({ user: safeUser, token });
});

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  req.user = sessions.get(token);
  next();
}

app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers.authorization.slice(7).trim();
  sessions.delete(token);
  res.json({ success: true });
});


// 📦 GET ITEMS
app.get('/api/items', requireAuth, (req, res) => {
  const { warehouse, role } = req.user;

  if (role === 'head_office') {
    return res.json(db.items);
  }

  const filtered = db.items.filter(i => i.warehouse === warehouse);
  res.json(filtered);
});


// ➕ ADD ITEM
app.post('/api/items', requireAuth, (req, res) => {
  const { name, barcode, brand, quantity, unit } = req.body;

  if (!name || !barcode || !brand || typeof quantity !== 'number' || !unit) {
    return res.status(400).json({ error: 'Некорректные данные' });
  }

  const validUser = USERS.find(u => u.username === req.user.username);

  if (!validUser) {
    return res.status(403).json({ error: 'Пользователь не найден' });
  }

  const item = {
    id: Date.now(),
    name,
    barcode,
    brand,
    quantity,
    unit,
    warehouse: validUser.warehouse,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.items.push(item);
  saveDB(db);

  addHistory({
    action: 'create',
    user: validUser.username,
    text: `Создан товар: ${name} (${quantity} ${unit})`
  });

  res.json(item);
});


// ✏️ UPDATE ITEM
app.put('/api/items/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { name, barcode, brand, quantity, unit } = req.body;

  const item = db.items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  const oldQuantity = item.quantity;

  item.name = name;
  item.barcode = barcode;
  item.brand = brand;
  item.quantity = quantity;
  item.unit = unit;
  item.updatedAt = new Date().toISOString();

  saveDB(db);

  addHistory({
    action: 'update',
    user: req.user.username,
    text: `Изменён товар: ${name}. Было: ${oldQuantity}, стало: ${quantity}`
  });

  res.json(item);
});


// ❌ DELETE ITEM
app.delete('/api/items/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);

  const index = db.items.findIndex(i => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  const removed = db.items.splice(index, 1)[0];
  saveDB(db);

  addHistory({
    action: 'delete',
    user: req.user.username,
    text: `Удалён товар: ${removed.name}`
  });

  res.json({ success: true });
});


// 📊 HISTORY
app.get('/api/history', requireAuth, (req, res) => {
  res.json(db.history || []);
});


app.post('/api/items/:id/writeoff', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { amount } = req.body;

  const item = db.items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Некорректное количество' });
  }

  if (item.quantity < amount) {
    return res.status(400).json({ error: 'Недостаточно товара' });
  }

  item.quantity -= amount;
  item.updatedAt = new Date().toISOString();

  saveDB(db);

  // 🧠 история
  db.history = db.history || [];
  db.history.push({
    id: Date.now(),
    action: 'writeoff',
    user: req.user.username,
    text: `Списание: ${item.name} -${amount} ${item.unit}`,
    date: new Date().toISOString()
  });

  saveDB(db);

  res.json(item);
});

app.get('/api/orders', requireAuth, (req, res) => {
  const orders = (db.orders || []).filter(o => (o.source || '1c') === '1c');
  res.json(orders);
});

app.post('/api/orders/:id/return', requireAuth, (req, res) => {
  const orderId = Number(req.params.id);
  const order = (db.orders || []).find(o => o.id === orderId && (o.source || '1c') === '1c');

  if (!order) {
    return res.status(404).json({ error: 'Накладная 1С не найдена' });
  }

  const lines = order.items || [];
  let processed = 0;

  for (const line of lines) {
    const item = db.items.find(i => i.barcode === line.barcode && i.warehouse === req.user.warehouse);
    if (!item) continue;
    item.quantity += Number(line.quantity || 0);
    item.updatedAt = new Date().toISOString();
    processed += 1;
  }

  saveDB(db);
  addHistory({
    action: 'return',
    user: req.user.username,
    text: `Возврат по накладной 1С №${orderId}. Позиций: ${processed}`
  });

  res.json({ success: true, processed });
});

app.post('/api/inventory/recount', requireAuth, (req, res) => {
  const { barcode, countedQty } = req.body;
  const item = db.items.find(i => i.barcode === barcode && i.warehouse === req.user.warehouse);
  if (!item) {
    return res.status(404).json({ error: 'Товар не найден на складе пользователя' });
  }
  if (typeof countedQty !== 'number' || countedQty < 0) {
    return res.status(400).json({ error: 'Некорректный фактический остаток' });
  }

  const before = item.quantity;
  item.quantity = countedQty;
  item.updatedAt = new Date().toISOString();
  saveDB(db);

  addHistory({
    action: 'inventory',
    user: req.user.username,
    text: `Инвентаризация ${item.name}: было ${before}, стало ${countedQty}`
  });

  res.json(item);
});

app.post('/api/transfers', requireAuth, (req, res) => {
  const { barcode, toWarehouse, amount } = req.body;
  if (!barcode || !toWarehouse || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Некорректные данные перемещения' });
  }

  const fromItem = db.items.find(i => i.barcode === barcode && i.warehouse === req.user.warehouse);
  if (!fromItem) {
    return res.status(404).json({ error: 'Товар не найден на складе отправителя' });
  }
  if (fromItem.quantity < amount) {
    return res.status(400).json({ error: 'Недостаточно товара для перемещения' });
  }

  let toItem = db.items.find(i => i.barcode === barcode && i.warehouse === toWarehouse);
  fromItem.quantity -= amount;
  fromItem.updatedAt = new Date().toISOString();

  if (!toItem) {
    toItem = {
      id: Date.now(),
      name: fromItem.name,
      barcode: fromItem.barcode,
      brand: fromItem.brand,
      quantity: 0,
      unit: fromItem.unit,
      warehouse: toWarehouse,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.items.push(toItem);
  }

  toItem.quantity += amount;
  toItem.updatedAt = new Date().toISOString();
  saveDB(db);

  addHistory({
    action: 'transfer',
    user: req.user.username,
    text: `Перемещение ${fromItem.name}: ${amount} ${fromItem.unit} из ${req.user.warehouse} в ${toWarehouse}`
  });

  res.json({ success: true, from: fromItem, to: toItem });
});

app.get('/api/registries/shipping-lists', requireAuth, (req, res) => {
  const fromShippingLists = (db.shippingLists || [])
    .filter(pl => (pl.source || '1c') === '1c');
  const fromOrders = (db.orders || [])
    .filter(o => (o.docType || '').toLowerCase() === 'pl' && (o.source || '1c') === '1c')
    .map(o => ({
      id: o.id,
      number: o.number || o.id,
      date: o.date,
      warehouse: o.warehouse || req.user.warehouse,
      items: o.items || [],
      source: '1c'
    }));

  const merged = [...fromShippingLists, ...fromOrders].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const dbb = new Date(b.date || 0).getTime();
    return dbb - da;
  });

  res.json(merged);
});

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});