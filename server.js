// 🔐 ПОДКЛЮЧЕНИЕ МОДУЛЕЙ
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AdmZip = require('adm-zip');

const { XMLParser } = require('fast-xml-parser');

const XLSX = require('xlsx');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 📂 ПУТИ
const DB_PATH = path.join(__dirname, 'database.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const EXPORTS_DIR = path.join(__dirname, 'exports');

// 📁 СОЗДАНИЕ ПАПОК
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR);
}

// ⚙️ EXPRESS
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 📦 ЗАГРУЗКА ФАЙЛОВ
const upload = multer({
  dest: UPLOADS_DIR,
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

// 👥 ПОЛЬЗОВАТЕЛИ
const USERS = [
  {
    username: 'admin',
    password: '12345',
    role: 'head_office',
    warehouse: 'all'
  },

  {
    username: 'jalalabad',
    password: '0304',
    role: 'branch',
    warehouse: 'Жалал-Абад'
  },

  {
    username: 'bishkek',
    password: '0000',
    role: 'branch',
    warehouse: 'Бишкек'
  },

  {
    username: 'osh',
    password: '0302',
    role: 'branch',
    warehouse: 'Ош'
  },

  {
    username: 'balykchi',
    password: '0305',
    role: 'branch',
    warehouse: 'Балыкчи'
  },

  {
    username: 'karakol',
    password: '0306',
    role: 'branch',
    warehouse: 'Каракол'
  },

  {
    username: 'talas',
    password: '0309',
    role: 'branch',
    warehouse: 'Талас'
  }
];

// 🔐 СЕССИИ
const sessions = new Map();

// 📂 ЗАГРУЗКА БАЗЫ
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initialDB = {
      items: [],
      history: [],
      salesInvoices: [],
      returnInvoices: [],
      shippingLists: [],
      agents: [],
      exportChanges: []
    };

    fs.writeFileSync(DB_PATH, JSON.stringify(initialDB, null, 2));
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  db.items = db.items || [];
  db.history = db.history || [];
  db.salesInvoices = db.salesInvoices || [];
  db.returnInvoices = db.returnInvoices || [];
  db.shippingLists = db.shippingLists || [];
  db.agents = db.agents || [];
  db.exportChanges = db.exportChanges || [];
  db.productDirectory = db.productDirectory || [];
  db.customerDirectory = db.customerDirectory || [];
  db.agentDirectory = db.agentDirectory || [];
  db.warehouseDirectory = db.warehouseDirectory || [];
  return db;
}

// 💾 СОХРАНЕНИЕ БАЗЫ
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDB();

// 🧠 ИСТОРИЯ
function addHistory(entry) {
  db.history.push({
    id: Date.now(),
    ...entry,
    date: new Date().toISOString()
  });

  saveDB(db);
}

// 📤 ИЗМЕНЕНИЯ ДЛЯ ЭКСПОРТА
function addExportChange(change) {
  db.exportChanges.push({
    id: Date.now(),
    ...change,
    exported: false,
    createdAt: new Date().toISOString()
  });

  saveDB(db);
}

// 🔐 ПРОВЕРКА ДОСТУПА
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token || !sessions.has(token)) {
    return res.status(401).json({
      error: 'Требуется авторизация'
    });
  }

  req.user = sessions.get(token);

  next();
}

// 👑 ТОЛЬКО АДМИН
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'head_office') {
    return res.status(403).json({
      error: 'Доступ только для администратора'
    });
  }

  next();
}

// 🌐 ГЛАВНАЯ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔐 ВХОД
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const user = USERS.find(
    u =>
      u.username === username &&
      u.password === password
  );

  if (!user) {
    return res.status(401).json({
      error: 'Неверный логин или пароль'
    });
  }

  const token = crypto.randomBytes(24).toString('hex');

  const safeUser = {
    username: user.username,
    role: user.role,
    warehouse: user.warehouse
  };

  sessions.set(token, safeUser);

  res.json({
    user: safeUser,
    token
  });
});

// 📦 ПОЛУЧИТЬ ТОВАРЫ
app.get('/api/items', requireAuth, (req, res) => {
  if (req.user.role === 'head_office') {
    return res.json(db.items);
  }

  const filtered = db.items.filter(
    item => item.warehouse === req.user.warehouse
  );

  res.json(filtered);
});

// ➕ ДОБАВИТЬ ТОВАР
app.post('/api/items', requireAuth, (req, res) => {
  const {
    name,
    barcode,
    brand,
    quantity,
    unit
  } = req.body;

  if (
    !name ||
    !barcode ||
    !brand ||
    typeof quantity !== 'number' ||
    !unit
  ) {
    return res.status(400).json({
      error: 'Некорректные данные товара'
    });
  }

  const warehouse =
    req.user.role === 'head_office'
      ? 'Жалал-Абад'
      : req.user.warehouse;

  const item = {
    id: Date.now(),
    oneCRef: null,
    name,
    barcode,
    brand,
    quantity,
    unit,
    warehouse,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.items.push(item);

  addHistory({
    action: 'create_item',
    user: req.user.username,
    text: `Создан товар ${name}`
  });

  addExportChange({
    type: 'item_create',
    item
  });

  saveDB(db);

  res.json(item);
});

// 🔻 СПИСАНИЕ
app.post('/api/items/:id/writeoff', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { amount } = req.body;

  const item = db.items.find(i => i.id === id);

  if (!item) {
    return res.status(404).json({
      error: 'Товар не найден'
    });
  }

  if (
    typeof amount !== 'number' ||
    amount <= 0
  ) {
    return res.status(400).json({
      error: 'Некорректное количество'
    });
  }

  if (item.quantity < amount) {
    return res.status(400).json({
      error: 'Недостаточно товара'
    });
  }

  item.quantity -= amount;
  item.updatedAt = new Date().toISOString();

  addHistory({
    action: 'writeoff',
    user: req.user.username,
    text: `Списание ${item.name}: -${amount}`
  });

  addExportChange({
    type: 'writeoff',
    itemId: item.id,
    barcode: item.barcode,
    amount
  });

  saveDB(db);

  res.json(item);
});

// 📋 ИНВЕНТАРИЗАЦИЯ
app.post('/api/inventory/recount', requireAuth, (req, res) => {
  const {
    barcode,
    countedQty
  } = req.body;

  const item = db.items.find(
    i =>
      i.barcode === barcode &&
      (
        req.user.role === 'head_office' ||
        i.warehouse === req.user.warehouse
      )
  );

  if (!item) {
    return res.status(404).json({
      error: 'Товар не найден'
    });
  }

  const before = item.quantity;

  item.quantity = countedQty;
  item.updatedAt = new Date().toISOString();

  addHistory({
    action: 'inventory',
    user: req.user.username,
    text: `Инвентаризация ${item.name}: ${before} → ${countedQty}`
  });

  addExportChange({
    type: 'inventory',
    barcode,
    countedQty
  });

  saveDB(db);

  res.json(item);
});

// 🔄 ПЕРЕМЕЩЕНИЕ
app.post('/api/transfers', requireAuth, (req, res) => {
  const {
    barcode,
    toWarehouse,
    amount
  } = req.body;

  const fromWarehouse =
    req.user.role === 'head_office'
      ? req.body.fromWarehouse || 'Жалал-Абад'
      : req.user.warehouse;

  const item = db.items.find(
    i =>
      i.barcode === barcode &&
      i.warehouse === fromWarehouse
  );

  if (!item) {
    return res.status(404).json({
      error: 'Товар не найден'
    });
  }

  if (item.quantity < amount) {
    return res.status(400).json({
      error: 'Недостаточно товара'
    });
  }

  item.quantity -= amount;

  let target = db.items.find(
    i =>
      i.barcode === barcode &&
      i.warehouse === toWarehouse
  );

  if (!target) {
    target = {
      id: Date.now(),
      name: item.name,
      barcode: item.barcode,
      brand: item.brand,
      quantity: 0,
      unit: item.unit,
      warehouse: toWarehouse,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.items.push(target);
  }

  target.quantity += amount;
  target.updatedAt = new Date().toISOString();

  addHistory({
    action: 'transfer',
    user: req.user.username,
    text: `Перемещение ${item.name}: ${fromWarehouse} → ${toWarehouse}`
  });

  addExportChange({
    type: 'transfer',
    barcode,
    amount,
    fromWarehouse,
    toWarehouse
  });

  saveDB(db);

  res.json({
    success: true
  });
});

// 🔁 ДАННЫЕ ДЛЯ ВОЗВРАТОВ
app.get('/api/returns-page-data', requireAuth, (req, res) => {
  const salesInvoices =
    req.user.role === 'head_office'
      ? db.salesInvoices
      : db.salesInvoices.filter(
          i => i.warehouse === req.user.warehouse
        );

  const returnInvoices =
    req.user.role === 'head_office'
      ? db.returnInvoices
      : db.returnInvoices.filter(
          i => i.warehouse === req.user.warehouse
        );

  res.json({
    salesInvoices,
    returnInvoices
  });
});

// 🔁 СОЗДАНИЕ ВОЗВРАТА
app.post('/api/returns/from-sales-invoice', requireAuth, (req, res) => {
  const {
    salesInvoiceId,
    items
  } = req.body;

  const salesInvoice =
    db.salesInvoices.find(
      i => Number(i.id) === Number(salesInvoiceId)
    );

  if (!salesInvoice) {
    return res.status(404).json({
      error: 'Расходная накладная не найдена'
    });
  }

  const returnInvoice = {
    id: Date.now(),
    sourceInvoiceId: salesInvoice.id,
    customer: salesInvoice.customer,
    warehouse: salesInvoice.warehouse,
    agent: salesInvoice.agent,
    date: new Date().toISOString().slice(0, 10),
    items: []
  };

  for (const returnItem of items) {

    if (
      typeof returnItem.quantity !== 'number' ||
      returnItem.quantity <= 0
    ) {
      continue;
    }

    returnInvoice.items.push(returnItem);

    let stockItem = db.items.find(
      i =>
        i.barcode === returnItem.barcode &&
        i.warehouse === salesInvoice.warehouse
    );

    if (!stockItem) {
      stockItem = {
        id: Date.now() + Math.random(),
        name: returnItem.name,
        barcode: returnItem.barcode,
        brand: returnItem.brand,
        quantity: 0,
        unit: returnItem.unit,
        warehouse: salesInvoice.warehouse,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.items.push(stockItem);
    }

    stockItem.quantity += returnItem.quantity;
    stockItem.updatedAt = new Date().toISOString();
  }

  db.returnInvoices.push(returnInvoice);

  addHistory({
    action: 'return_invoice',
    user: req.user.username,
    text: `Создан возврат №${returnInvoice.id}`
  });

  addExportChange({
    type: 'return_invoice',
    invoice: returnInvoice
  });

  saveDB(db);

  res.json({
    success: true,
    returnInvoice
  });
}
);

// 📋 РЕЕСТРЫ
app.get('/api/registries/shipping-lists', requireAuth, (req, res) => {
  const rows =
    req.user.role === 'head_office'
      ? db.shippingLists
      : db.shippingLists.filter(
          i => i.warehouse === req.user.warehouse
        );

  res.json(rows);
}
);

// 👥 АГЕНТЫ / ЭКСПЕДИТОРЫ
app.get('/api/agents', requireAuth, (req, res) => {
  const agents = new Set();

  db.agentDirectory.forEach(agent => {
    const name =
     agent.name ||
     agent.agent ||
     agent.expeditor ||
     agent.driver ||
     '';

    if (name) {
     agents.add(name);
    }
  });

  // 🚚 Водитель в погрузочном листе = экспедитор
  db.shippingLists.forEach(doc => {
    if (doc.driver) {
      agents.add(doc.driver);
    }
  });

  const result = Array.from(agents)
    .filter(name => {
      const lower = String(name).toLowerCase();

      return (
        name &&
        name !== 'Не указан' &&
        !lower.includes('автообмен') &&
        !lower.includes('бухгалтер') &&
        !lower.includes('оператор') &&
        !lower.includes('администратор') &&
        !lower.includes('пользователь')
      );
    })
    .map(name => ({ name }));

  res.json(result);
});

// 📊 ОТЧЁТ ВОЗВРАТОВ
app.get('/api/reports/returns', requireAuth, (req, res) => {

  const {
    agent,
    date,
    sort
  } = req.query;

  let rows = [];

  for (const invoice of db.returnInvoices) {

    for (const item of invoice.items) {

      rows.push({
        date: invoice.date,
        customer: invoice.customer,
        agent: invoice.agent,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit
      });
    }
  }

  if (agent && agent !== 'all') {
    rows = rows.filter(r => r.agent === agent);
  }

  if (date) {
    rows = rows.filter(r => r.date === date);
  }

  if (sort === 'customer') {
    rows.sort((a, b) =>
      a.customer.localeCompare(b.customer)
    );
  }

  if (sort === 'product') {
    rows.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  if (sort === 'agent') {
    rows.sort((a, b) =>
      a.agent.localeCompare(b.agent)
    );
  }

  if (sort === 'date') {
    rows.sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  res.json(rows);
});

// 📥 ИМПОРТ ZIP ИЗ 1С (XML)
app.post('/api/import-1c-zip', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ZIP-архив не выбран' });
    }

    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries();

    const xmlEntry = entries.find(entry =>
      !entry.isDirectory && entry.entryName.toLowerCase().endsWith('.xml')
    );

    if (!xmlEntry) {
      return res.status(400).json({ error: 'XML файл 1С не найден внутри ZIP' });
    }

    const xmlContent = zip.readAsText(xmlEntry);

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseTagValue: true,
      trimValues: true,
      removeNSPrefix: false
    });

    const parsed = parser.parse(xmlContent);

    function findByKey(obj, targetKey) {
      if (!obj || typeof obj !== 'object') return null;

      if (Object.prototype.hasOwnProperty.call(obj, targetKey)) {
        return obj[targetKey];
      }

      for (const key of Object.keys(obj)) {
        const found = findByKey(obj[key], targetKey);
        if (found) return found;
      }

      return null;
    }

    function toArray(value) {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    }

    function getRows(doc) {
      const rows =
        doc?.тчТМЦ?.Row ||
        doc?.Товары?.Row ||
        doc?.Товары?.Строка ||
        doc?.Товары ||
        [];

      return toArray(rows);
    }

    function getRef(value) {
      if (!value) return '';
      if (typeof value === 'string') {
        return value.trim();
      }

      return (
        value.Ref ||
        value.ref ||
        value.Ссылка ||
        value.ID ||
        value.id ||
        value.uuid ||
        value.UUID ||
        ''
      );
    }

    function getWarehouseName(value) {
      const ref = getRef(value);
      if (!ref) return 'Жалал-Абад';
      return warehouseMap[ref] || ref;
    }

    function getCustomerName(value) {
      const ref = getRef(value);
      if (!ref) return 'Не указан';
      return customerMap[ref] || ref;
    }

    function getAgentName(value) {
      const ref = getRef(value);
      if (!ref) return '';

      const found = db.agentDirectory.find(
        item => String(item.ref) === String(ref)
      );

      return found?.name || agentMap[ref] || ref;
    }

    function getProduct(row) {

  const ref = getRef(
    row?.ТМЦ ||
    row?.Номенклатура ||
    row?.Товар ||
    row?.Product ||
    row?.НоменклатураСсылка ||
    row
  );

  const directoryProduct = db.productDirectory.find(item =>
    String(item.ref || '').trim() === String(ref).trim()
  );

  const itemFromDB = db.items.find(item =>
    String(item.oneCRef || '').trim() === String(ref).trim() ||
    String(item.barcode || '').trim() === String(ref).trim() ||
    String(item.id || '').trim() === String(ref).trim()
  );

  if (itemFromDB && !itemFromDB.oneCRef) {
    itemFromDB.oneCRef = ref;
  }

  return {
    ref,

    barcode:
      directoryProduct?.barcode ||
      itemFromDB?.barcode ||
      ref,

    name:
      directoryProduct?.name ||
      itemFromDB?.name ||
      ref,

    brand:
      directoryProduct?.brand ||
      itemFromDB?.brand ||
      'Без бренда',

    unit:
      directoryProduct?.unit ||
      itemFromDB?.unit ||
      'шт'
  };
}

    // 👤 ПОИСК ПОКУПАТЕЛЯ ПО UUID
    function findCustomerName(ref, fallback = '') {
      if (!ref) {
        return fallback || 'Не указан';
      }
      const found = db.customerDirectory.find(item => String(item.ref) === String(ref));
      return (found?.name || fallback || ref);
    }

    // 👥 ПОИСК АГЕНТА ПО UUID
    function findAgentName(ref) {
      if (!ref) { 
        return ''; 
      }
      const found = db.agentDirectory.find(item => String(item.ref) === String(ref));
      return found?.name || '';
    }

    // 🏢 ПОИСК СКЛАДА ПО UUID
    function findWarehouseName(ref) {
      if (!ref) return 'Жалал-Абад';
      const found = db.warehouseDirectory.find(item => String(item.ref) === String(ref));
      return found?.name || ref;
    }

    // ✅ В XML реальные данные лежат глубже, поэтому ищем нужные объекты по всему XML
    const salesDocs = toArray(findByKey(parsed, 'DocumentObject.РасходнаяНакладная'));
    console.log('SALES DOC SAMPLE:', JSON.stringify(salesDocs[0], null, 2));
    const returnDocs = toArray(findByKey(parsed, 'DocumentObject.ВозвратОтПокупателя'));
    
    const shippingDocs = toArray(findByKey(parsed, 'DocumentObject.ПогрузочныйЛист'));
    console.log('SHIPPING DOCS COUNT:', shippingDocs.length );

    if (shippingDocs[0]) {
      console.log('FIRST SHIPPING DOC:', JSON.stringify( shippingDocs[0], null, 2));
    }

    const transferDocs = toArray(findByKey(parsed, 'DocumentObject.ПеремещениеТоваров'));

    const productCatalogs = [
      ...toArray(findByKey(parsed, 'CatalogObject.Номенклатура')),
      ...toArray(findByKey(parsed, 'CatalogObject.Номенклатура_Партии'))
    ];

    const warehouseCatalogs = [
      ...toArray(findByKey(parsed, 'CatalogObject.Склады')),
      ...toArray(findByKey(parsed, 'CatalogObject.МестаХранения'))
    ];

    const customerCatalogs = [
      ...toArray(findByKey(parsed, 'CatalogObject.Контрагенты'))
    ];

    const agentCatalogs = [
      ...toArray(findByKey(parsed, 'CatalogObject.Пользователи')),
      ...toArray(findByKey(parsed, 'CatalogObject.Сотрудники'))
    ];
    console.log(
     'AGENT CATALOGS:',
     JSON.stringify(agentCatalogs, null, 2)
    );

    const productMap = {};
    const warehouseMap = {};
    const customerMap = {};
    const agentMap = {};

    productCatalogs.forEach(product => {
      const ref = product.Ref || product.Ссылка || product.ID;
      if (!ref) return;

      productMap[ref] = {
        name: product.Description || product.Наименование || product.НаименованиеПолное || ref,
        barcode: product.Штрихкод || product.ШтрихКод || product.Код || ref,
        brand: product.Бренд || product.ТорговаяМарка || 'Без бренда',
        unit: product.ЕдиницаИзмерения || product.БазоваяЕдиницаИзмерения || 'шт'
      };
    });

    warehouseCatalogs.forEach(w => {
      const ref = w.Ref || w.Ссылка || w.ID;
      if (!ref) return;
      warehouseMap[ref] = w.Description || w.Наименование || ref;
    });

    customerCatalogs.forEach(c => {
      const ref = c.Ref || c.Ссылка || c.ID;
      if (!ref) return;
      customerMap[ref] = c.Description || c.Наименование || ref;
    });

    agentCatalogs.forEach(a => {

  const ref =
    a.Ref ||
    a.Ссылка ||
    a.ID;

  if (!ref) return;

  const name =
    a.Description ||
    a.Наименование ||
    a.Name ||
    ref;

  console.log(
    'АГЕНТ ИЗ XML:',
    ref,
    name
  );

  agentMap[ref] = name;
});

    let importedItems = 0;
    let importedSalesInvoices = 0;
    let importedReturnInvoices = 0;
    let importedShippingLists = 0;
    let importedTransfers = 0;

    // 🧾 РАСХОДНЫЕ НАКЛАДНЫЕ
    salesDocs.forEach(doc => {
      const number = doc.Number || doc.Номер || `РН-${Date.now()}`;
      const date = doc.Date || doc.Дата || new Date().toISOString();
      const warehouse = findWarehouseName(getRef(doc.МестоХранения || doc.Склад || doc.СкладОтправитель || doc.СкладПолучатель));
      const customer = doc.Примечание || getCustomerName(doc.Получатель || doc.Контрагент || doc.Покупатель) || 'Не указан';
      const agent = getAgentName(doc.ТорговыйПредставитель || doc.Агент || doc.Экспедитор) || '';

      const rows = getRows(doc).map(row => {
        const product = getProduct(row);
        const quantity = Number(row.Количество || row.Quantity || 0);

        return {
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          quantity,
          unit: product.unit
        };
      }).filter(item => item.quantity > 0);

      const invoiceObject = {
        id: number,
        invoiceNumber: number,
        customer,
        agent,
        warehouse,
        date,
        items: rows
      };

      const index = db.salesInvoices.findIndex(i => String(i.invoiceNumber) === String(number));

      if (index >= 0) {
        db.salesInvoices[index] = invoiceObject;
      } else {
        db.salesInvoices.push(invoiceObject);
        importedSalesInvoices++;
      }
    });

    // 🔁 ВОЗВРАТЫ ОТ ПОКУПАТЕЛЯ
    returnDocs.forEach(doc => {
      const number = doc.Number || doc.Номер || `ВР-${Date.now()}`;
      const date = doc.Date || doc.Дата || new Date().toISOString();
      const warehouse = findWarehouseName(getRef(doc.МестоХранения || doc.Склад || doc.СкладОтправитель || doc.СкладПолучатель));
      const customer = doc.Примечание || getCustomerName(doc.Получатель || doc.Контрагент || doc.Покупатель) || 'Не указан';
      const agent = getAgentName(doc.ТорговыйПредставитель || doc.Агент || doc.Экспедитор) || '';
      const sourceInvoiceId = getRef(doc.ДокОсн || doc.Основание || doc.ДокументОснование);

      const rows = getRows(doc).map(row => {
        const product = getProduct(row);
        const quantity = Number(row.Количество || row.Quantity || 0);

        return {
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          quantity,
          unit: product.unit
        };
      }).filter(item => item.quantity > 0);

      const returnObject = {
        id: number,
        returnNumber: number,
        sourceInvoiceId,
        customer,
        agent,
        warehouse,
        date,
        items: rows
      };

      const index = db.returnInvoices.findIndex(i => String(i.returnNumber) === String(number));

      if (index >= 0) {
        db.returnInvoices[index] = returnObject;
      } else {
        db.returnInvoices.push(returnObject);
        importedReturnInvoices++;
      }
    });

    // 🚚 ПОГРУЗОЧНЫЕ ЛИСТЫ / РЕЕСТРЫ
    shippingDocs.forEach(doc => {
      const number = doc.Number || doc.Номер || `ПЛ-${Date.now()}`;
      const date = doc.Date || doc.Дата || new Date().toISOString();
      const warehouse = findWarehouseName(getRef(doc.МестоХранения || doc.Склад || doc.СкладОтправитель || doc.СкладПолучатель));
      const driverSource =
        doc.Водитель ||
        doc.Экспедитор ||
        doc.Агент ||
        doc.Ответственный ||
        '';

      const driverRef =
        getRef(driverSource) ||
        getRef(driverSource?.Ссылка) ||
        getRef(driverSource?.Ref) ||
        getRef(driverSource?.UUID) ||
        getRef(driverSource?.id);

      const driverFound =
        db.agentDirectory.find(
          item =>
          String(item.ref).trim() ===
          String(driverRef).trim()
        );

      const driver =
        driverFound?.name ||
        driverSource?.Description ||
        driverSource?.Наименование ||
        driverSource?.Name ||
        driverRef ||
        'Не указан';

      const shippingRows = [
        ...toArray(doc.тчТМЦ?.Row),
        ...toArray(doc.тчТМЦ),
        ...toArray(doc.Товары?.Row),
        ...toArray(doc.Товары?.Строка),
        ...toArray(doc.Товары),
        ...toArray(doc.ТабличнаяЧасть?.Row),
        ...toArray(doc.ТабличнаяЧасть),
        ...toArray(doc.ТЧ?.Row),
        ...toArray(doc.ТЧ),
        ...toArray(doc.СписокТоваров),
        ...toArray(doc.Номенклатура)
      ];

      const rows = shippingRows.map(row => {
        console.log(
          'SHIPPING ROW:',
          JSON.stringify(row, null, 2)
        );

        const product = getProduct({
          ТМЦ:
          row.ТМЦ ||
          row.Номенклатура ||
          row.Товар ||
          row.НоменклатураСсылка ||
          row.Product
        });

        const quantity = Number(
          row.Количество ||
          row.Quantity ||
          row.Qty ||
          0
        );

        return {
          barcode: product.barcode,
          name:
            row.Наименование ||
            product.name,
            brand: product.brand,
            quantity,
            unit:
            row.Единица ||
            product.unit
        };
      }).filter(item => item.quantity > 0);

      const oldDoc = db.shippingLists.find(
        i => String(i.number || i.registryNumber) === String(number)
      );

      const shippingObject = {
        id: number,
        number,
        registryNumber: number,
        driver,
        warehouse,
        date,
        items: rows,
        collected: oldDoc?.collected || false,
        collectedAt: oldDoc?.collectedAt || null,
        source: '1c'
      };

      const index = db.shippingLists.findIndex(i => String(i.number || i.registryNumber) === String(number));

      if (index >= 0) {
        db.shippingLists[index] = shippingObject;
      } else {
        db.shippingLists.push(shippingObject);
        importedShippingLists++;
      }
    });

    // 🔄 ПЕРЕМЕЩЕНИЯ ТОВАРОВ
    transferDocs.forEach(doc => {
      const fromWarehouse = getWarehouseName(doc.МестоХранения || doc.СкладОтправитель || doc.Склад);
      const toWarehouse = getWarehouseName(doc.СкладПриемник || doc.СкладПолучатель);
      const rows = getRows(doc);

      rows.forEach(row => {
        const product = getProduct(row);
        const quantity = Number(row.Количество || 0);

        if (!product.barcode || quantity <= 0) return;

        let item = db.items.find(i =>
          ( String(i.oneCRef || '') === String(product.ref) || String(i.barcode || '') === String(product.barcode))
          &&
          i.warehouse === toWarehouse
        );

        if (!item) {
          item = {
            id: Date.now() + Math.random(),
            oneCRef: product.ref,
            name: product.name,
            barcode: product.barcode,
            brand: product.brand,
            quantity: 0,
            unit: product.unit,
            warehouse: toWarehouse,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          db.items.push(item);
          importedItems++;
        }

        item.quantity += quantity;
        item.updatedAt = new Date().toISOString();
      });

      importedTransfers++;
    });

    addHistory({
      action: 'import_1c_xml',
      user: req.user.username,
      text: `Импорт XML из 1С: расходные ${importedSalesInvoices}, возвраты ${importedReturnInvoices}, реестры ${importedShippingLists}, перемещения ${importedTransfers}`
    });

    saveDB(db);

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      items: importedItems,
      salesInvoices: importedSalesInvoices,
      returnInvoices: importedReturnInvoices,
      shippingLists: importedShippingLists,
      transfers: importedTransfers
    });

  } catch (err) {
    console.error(err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: err.message || 'Ошибка обработки ZIP-архива 1С'
    });
  }
});

// 📤 ЭКСПОРТ ZIP ДЛЯ 1С
app.get(
  '/api/export-1c-zip',
  requireAuth,
  requireAdmin,
  (req, res) => {

    try {

      const zip = new AdmZip();

      const changes =
        db.exportChanges.filter(c => !c.exported);

      zip.addFile(
        'exportChanges.json',
        Buffer.from(
          JSON.stringify(changes, null, 2),
          'utf8'
        )
      );

      zip.addFile(
        'returnInvoices.json',
        Buffer.from(
          JSON.stringify(db.returnInvoices, null, 2),
          'utf8'
        )
      );

      zip.addFile(
        'history.json',
        Buffer.from(
          JSON.stringify(db.history, null, 2),
          'utf8'
        )
      );

      const fileName =
        `export_1c_${Date.now()}.zip`;

      const filePath =
        path.join(EXPORTS_DIR, fileName);

      zip.writeZip(filePath);

      for (const change of changes) {
        change.exported = true;
      }

      saveDB(db);

      res.download(filePath, fileName);

    } catch (err) {

      res.status(500).json({
        error: 'Ошибка экспорта ZIP'
      });
    }
  }
);

// 📚 ИМПОРТ СПРАВОЧНИКОВ
app.post(
  '/api/import-directory',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  async (req, res) => {

    try {

      if (!req.file) {
        return res.status(400).json({
          error: 'Файл не выбран'
        });
      }

      const type = req.body.type;

      const ext =
        path.extname(req.file.originalname)
        .toLowerCase();

      let rows = [];

      // 📄 XLSX
      if (ext === '.xlsx') {

        const workbook =
          XLSX.readFile(req.file.path);

        const sheet =
          workbook.Sheets[
            workbook.SheetNames[0]
          ];

        rows =
          XLSX.utils.sheet_to_json(sheet);
      }

      // 📄 JSON
      else if (ext === '.json') {

        rows = JSON.parse(
          fs.readFileSync(req.file.path, 'utf8')
        );
      }

      else {

        return res.status(400).json({
          error: 'Поддерживаются XLSX и JSON'
        });
      }

      // =====================================================
      // 📦 ТОВАРЫ
      // =====================================================

      if (type === 'products') {

        rows.forEach(row => {

          db.productDirectory.push({

            ref:
              row.ref ||
              row.Ref ||
              row.ID ||
              row.id,

            name:
              row.name ||
              row.Name ||
              row.Наименование,

            barcode:
              row.barcode ||
              row.Штрихкод ||
              '',

            brand:
              row.brand ||
              row.Бренд ||
              '',

            unit:
              row.unit ||
              row.Единица ||
              'шт'
          });
        });
      }

      // =====================================================
      // 👤 ПОКУПАТЕЛИ
      // =====================================================

      if (type === 'customers') {

        rows.forEach(row => {

          db.customerDirectory.push({

            ref:
              row.ref ||
              row.Ref ||
              row.ID,

            name:
              row.name ||
              row.Name ||
              row.Наименование
          });
        });
      }

      // =====================================================
      // 👥 АГЕНТЫ
      // =====================================================

      if (type === 'agents') {

        rows.forEach(row => {

          db.agentDirectory.push({

            ref:
              row.ref ||
              row.Ref ||
              row.ID,

            name:
              row.name ||
              row.Name ||
              row.Наименование
          });
        });
      }

      // =====================================================
      // 🏢 СКЛАДЫ
      // =====================================================

      if (type === 'warehouses') {

        rows.forEach(row => {

          db.warehouseDirectory.push({

            ref:
              row.ref ||
              row.Ref ||
              row.ID,

            name:
              row.name ||
              row.Name ||
              row.Наименование
          });
        });
      }

      saveDB(db);

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        count: rows.length
      });

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message
      });
    }
  }
);

// ✅ ОТМЕТИТЬ ПОГРУЗОЧНЫЙ ЛИСТ КАК СОБРАННЫЙ
app.post('/api/registries/shipping-lists/:id/collected', requireAuth, (req, res) => {
  const id = req.params.id;

  const doc = db.shippingLists.find(item =>
    String(item.id) === String(id) ||
    String(item.number) === String(id) ||
    String(item.registryNumber) === String(id)
  );

  if (!doc) {
    return res.status(404).json({
      error: 'Погрузочный лист не найден'
    });
  }

  doc.collected = !doc.collected;
  doc.collectedAt = doc.collected ? new Date().toISOString() : null;
  doc.collectedBy = doc.collected ? req.user.username : null;

  addHistory({
    action: 'shipping_collected',
    user: req.user.username,
    text: `${doc.collected ? 'Собран' : 'Снят статус сборки'} погрузочный лист №${doc.number || doc.registryNumber || doc.id}`
  });

  saveDB(db);

  res.json(doc);
});

// 🚀 СТАРТ
app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});