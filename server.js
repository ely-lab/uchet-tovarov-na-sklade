const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(__dirname));

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

  res.json(user);
});


// 📦 GET ITEMS
app.get('/api/items', (req, res) => {
  const { warehouse, role } = req.query;

  if (role === 'head_office') {
    return res.json(db.items);
  }

  const filtered = db.items.filter(i => i.warehouse === warehouse);
  res.json(filtered);
});


// ➕ ADD ITEM
app.post('/api/items', (req, res) => {
  const { name, barcode, brand, quantity, unit, user } = req.body;

  if (!name || !barcode || !brand || typeof quantity !== 'number' || !unit) {
    return res.status(400).json({ error: 'Некорректные данные' });
  }

  if (!user || !user.username) {
    return res.status(400).json({ error: 'Пользователь не передан' });
  }

  const validUser = USERS.find(u => u.username === user.username);

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
app.put('/api/items/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, barcode, brand, quantity, unit, user } = req.body;

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
    user: user?.username || 'unknown',
    text: `Изменён товар: ${name}. Было: ${oldQuantity}, стало: ${quantity}`
  });

  res.json(item);
});


// ❌ DELETE ITEM
app.delete('/api/items/:id', (req, res) => {
  const id = Number(req.params.id);

  const index = db.items.findIndex(i => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  const removed = db.items.splice(index, 1)[0];
  saveDB(db);

  addHistory({
    action: 'delete',
    user: 'admin',
    text: `Удалён товар: ${removed.name}`
  });

  res.json({ success: true });
});


// 📊 HISTORY
app.get('/api/history', (req, res) => {
  res.json(db.history || []);
});


app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});

app.post('/api/items/:id/writeoff', (req, res) => {
  const id = Number(req.params.id);
  const { amount, user } = req.body;

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
    user: user?.username || 'unknown',
    text: `Списание: ${item.name} -${amount} ${item.unit}`,
    date: new Date().toISOString()
  });

  saveDB(db);

  res.json(item);
});

app.get('/api/orders', (req, res) => {
  res.json(db.orders || []);
});