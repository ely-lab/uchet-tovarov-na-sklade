// 🔐 ЭЛЕМЕНТЫ
const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');

const moduleMenu = document.getElementById('module-menu');
const warehouseSection = document.getElementById('warehouse-section');
const returnsSection = document.getElementById('returns-section');
const registriesSection = document.getElementById('registries-section');

const inventoryContainer = document.getElementById('inventory');
const searchInput = document.getElementById('search');
const filterBrand = document.getElementById('filter-brand');
const summaryOutput = document.getElementById('summary');

const btnModuleWarehouse = document.getElementById('btn-module-warehouse');
const btnModuleReturns = document.getElementById('btn-module-returns');
const btnModuleRegistries = document.getElementById('btn-module-registries');

const btnLogout = document.getElementById('btn-logout');
const btnAddItem = document.getElementById('btn-add-item');
const btnBackMenu = document.getElementById('btn-back-menu');
const btnInventory = document.getElementById('btn-inventory');
const btnTransfer = document.getElementById('btn-transfer');

const invoiceList = document.getElementById('invoice-list');
const invoiceDetails = document.getElementById('invoice-details');
const invoiceZipInput = document.getElementById('invoice-zip-input');
const btnUploadInvoices = document.getElementById('btn-upload-invoices');
const invoiceUploadMessage = document.getElementById('invoice-upload-message');

const registryList = document.getElementById('registry-list');

const addSection = document.getElementById('add-section');
const itemForm = document.getElementById('item-form');
const closeModal = document.getElementById('closeModal');

// 🔑 ДАННЫЕ
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');
let items = [];
let invoices = [];
let selectedInvoice = null;

// 📡 API
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const res = await fetch(url, {
    headers,
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Ошибка сервера');
  }

  return res.json();
}

// 🔐 ВХОД
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();

  try {
    const res = await apiFetch('/api/login', {
      method: 'POST',
      body: { username, password }
    });

    token = res.token;
    currentUser = res.user;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));

    loginScreen.classList.add('hidden');
    app.classList.remove('hidden');

    showModule('menu');
  } catch (err) {
    loginMessage.textContent = err.message;
  }
});

// 🚪 ВЫХОД
btnLogout.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.reload();
});

// 🔄 МОДУЛИ
function showModule(name) {
  moduleMenu.classList.toggle('hidden', name !== 'menu');

  warehouseSection.classList.toggle('hidden', name !== 'warehouse');
  returnsSection.classList.toggle('hidden', name !== 'returns');
  registriesSection.classList.toggle('hidden', name !== 'registries');

  btnLogout.classList.remove('hidden');
  btnBackMenu.classList.toggle('hidden', name === 'menu');

  btnAddItem.classList.toggle(
    'hidden',
    !(name === 'warehouse' && currentUser && currentUser.role === 'head_office')
  );

  btnInventory.classList.toggle('hidden', name !== 'warehouse');
  btnTransfer.classList.toggle('hidden', name !== 'warehouse');

  if (name === 'warehouse') {
    loadItems();
  }

  if (name === 'returns') {
    loadInvoices();
  }

  if (name === 'registries') {
    loadRegistries();
  }
}

// 📦 ЗАГРУЗКА ТОВАРОВ
async function loadItems() {
  try {
    const data = await apiFetch('/api/items');
    items = data;
    renderItems(items);
  } catch (err) {
    inventoryContainer.innerHTML = `<p>${err.message}</p>`;
  }
}

// 🎨 ОТРИСОВКА ТОВАРОВ
function renderItems(list) {
  inventoryContainer.innerHTML = '';

  if (!list.length) {
    inventoryContainer.innerHTML = '<p class="muted">Товары не найдены</p>';
    summaryOutput.textContent = 'Товаров: 0';
    return;
  }

  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'card';

    el.innerHTML = `
      <h3>${item.name}</h3>
      <div class="badges">
        <span class="badge">Бренд: ${item.brand || '-'}</span>
        <span class="badge">Штрихкод: ${item.barcode || '-'}</span>
        <span class="badge">Остаток: ${item.quantity} ${item.unit || 'шт'}</span>
        ${item.warehouse ? `<span class="badge accent">📦 ${item.warehouse}</span>` : ''}
      </div>
      <button class="danger" onclick="handleWriteOff(${item.id})">Списать</button>
    `;

    inventoryContainer.appendChild(el);
  });

  summaryOutput.textContent = `Товаров: ${list.length}`;
}

// 🔍 ПОИСК
searchInput.addEventListener('input', applyFilters);
filterBrand.addEventListener('change', applyFilters);

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  const brand = filterBrand.value;

  const filtered = items.filter(item => {
    const matchesText =
      String(item.name || '').toLowerCase().includes(q) ||
      String(item.barcode || '').includes(q);

    const matchesBrand =
      brand === 'all' || item.brand === brand;

    return matchesText && matchesBrand;
  });

  renderItems(filtered);
}

// ➕ ОТКРЫТЬ МОДАЛЬНОЕ ОКНО
btnAddItem.addEventListener('click', () => {
  addSection.classList.remove('hidden');
});

// ❌ ЗАКРЫТЬ МОДАЛЬНОЕ ОКНО
closeModal.addEventListener('click', () => {
  addSection.classList.add('hidden');
});

// ➕ ДОБАВИТЬ ТОВАР
itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('item-name').value.trim();
  const barcode = document.getElementById('item-barcode').value.trim();
  const brand = document.getElementById('item-brand').value;
  const quantity = Number(document.getElementById('item-quantity').value);
  const unit = document.getElementById('item-unit').value;

  if (!name || !barcode || !brand || Number.isNaN(quantity) || quantity < 0 || !unit) {
    alert('Заполните поля корректно');
    return;
  }

  try {
    await apiFetch('/api/items', {
      method: 'POST',
      body: { name, barcode, brand, quantity, unit }
    });

    itemForm.reset();
    addSection.classList.add('hidden');
    loadItems();
    alert('Товар добавлен');
  } catch (err) {
    alert(err.message);
  }
});

// 🔻 СПИСАНИЕ
async function handleWriteOff(id) {
  const amountStr = prompt('Введите количество для списания:');
  if (!amountStr) return;

  const amount = Number(amountStr);

  if (Number.isNaN(amount) || amount <= 0) {
    alert('Введите корректное число');
    return;
  }

  try {
    await apiFetch(`/api/items/${id}/writeoff`, {
      method: 'POST',
      body: { amount }
    });

    alert('Списание выполнено');
    loadItems();
  } catch (err) {
    alert(err.message);
  }
}

// 📋 ИНВЕНТАРИЗАЦИЯ
btnInventory.addEventListener('click', async () => {
  const barcode = prompt('Введите штрихкод товара:');
  if (!barcode) return;

  const countedQty = Number(prompt('Введите фактический остаток:'));

  if (Number.isNaN(countedQty) || countedQty < 0) {
    alert('Некорректное количество');
    return;
  }

  try {
    await apiFetch('/api/inventory/recount', {
      method: 'POST',
      body: {
        barcode: barcode.trim(),
        countedQty
      }
    });

    alert('Инвентаризация применена');
    loadItems();
  } catch (err) {
    alert(err.message);
  }
});

// 🔄 ПЕРЕМЕЩЕНИЕ
btnTransfer.addEventListener('click', async () => {
  const barcode = prompt('Введите штрихкод товара:');
  if (!barcode) return;

  const toWarehouse = prompt('Куда переместить товар?');
  if (!toWarehouse) return;

  const amount = Number(prompt('Введите количество для перемещения:'));

  if (Number.isNaN(amount) || amount <= 0) {
    alert('Некорректное количество');
    return;
  }

  try {
    await apiFetch('/api/transfers', {
      method: 'POST',
      body: {
        barcode: barcode.trim(),
        toWarehouse: toWarehouse.trim(),
        amount
      }
    });

    alert('Перемещение выполнено');
    loadItems();
  } catch (err) {
    alert(err.message);
  }
});

// 📄 ЗАГРУЗКА НАКЛАДНЫХ
async function loadInvoices() {
  try {
    invoices = await apiFetch('/api/invoices');

    invoiceList.innerHTML = '';
    invoiceDetails.innerHTML = '<p class="muted">Накладная не выбрана</p>';

    if (!invoices.length) {
      invoiceList.innerHTML = '<p class="muted">Накладные не найдены</p>';
      return;
    }

    invoices.forEach(invoice => {
      const el = document.createElement('div');
      el.className = 'invoice-card';

      el.innerHTML = `
        <h3>Накладная №${invoice.id}</h3>
        <p><b>Клиент:</b> ${invoice.customer || '-'}</p>
        <p><b>Склад:</b> ${invoice.warehouse || '-'}</p>
        <p><b>Дата:</b> ${invoice.date || '-'}</p>
        <p><b>Позиций:</b> ${(invoice.items || []).length}</p>
        <button class="primary" onclick="openInvoice(${invoice.id})">Открыть</button>
      `;

      invoiceList.appendChild(el);
    });
  } catch (err) {
    invoiceList.innerHTML = `<p>${err.message}</p>`;
  }
}

// 📋 ОТКРЫТЬ НАКЛАДНУЮ
function openInvoice(invoiceId) {
  selectedInvoice = invoices.find(i => Number(i.id) === Number(invoiceId));

  if (!selectedInvoice) {
    alert('Накладная не найдена');
    return;
  }

  const rows = (selectedInvoice.items || []).map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.name || '-'}</td>
      <td>${item.barcode || '-'}</td>
      <td>${item.quantity} ${item.unit || 'шт'}</td>
      <td>
        <input
          type="number"
          min="0"
          max="${item.quantity}"
          step="0.001"
          class="return-input"
          data-barcode="${item.barcode}"
          data-name="${item.name || ''}"
          data-unit="${item.unit || 'шт'}"
          data-max="${item.quantity}"
          placeholder="0"
        />
      </td>
    </tr>
  `).join('');

  invoiceDetails.innerHTML = `
    <div class="invoice-header">
      <h3>Накладная №${selectedInvoice.id}</h3>
      <p><b>Клиент:</b> ${selectedInvoice.customer || '-'}</p>
      <p><b>Склад:</b> ${selectedInvoice.warehouse || '-'}</p>
      <p><b>Дата:</b> ${selectedInvoice.date || '-'}</p>
    </div>

    <div class="table-wrap">
      <table class="return-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Товар</th>
            <th>Штрихкод</th>
            <th>В накладной</th>
            <th>Возврат</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <button class="primary return-submit" onclick="submitReturn()">Оформить возврат</button>
  `;
}

// 🔁 ОФОРМИТЬ ВОЗВРАТ
async function submitReturn() {
  if (!selectedInvoice) {
    alert('Выберите накладную');
    return;
  }

  const inputs = document.querySelectorAll('.return-input');

  const returnItems = Array.from(inputs)
    .map(input => {
      const quantity = Number(input.value);
      const max = Number(input.dataset.max);

      if (quantity > max) {
        throw new Error(`Нельзя вернуть больше, чем указано в накладной: ${input.dataset.name}`);
      }

      return {
        barcode: input.dataset.barcode,
        name: input.dataset.name,
        unit: input.dataset.unit,
        quantity
      };
    })
    .filter(item => item.quantity > 0);

  if (!returnItems.length) {
    alert('Укажите количество хотя бы для одного товара');
    return;
  }

  try {
    await apiFetch('/api/returns', {
      method: 'POST',
      body: {
        invoiceId: selectedInvoice.id,
        items: returnItems
      }
    });

    alert('Возврат оформлен');
    selectedInvoice = null;
    invoiceDetails.innerHTML = '<p class="muted">Накладная не выбрана</p>';
    loadInvoices();
  } catch (err) {
    alert(err.message);
  }
}

// 📦 ЗАГРУЗКА ZIP С НАКЛАДНЫМИ
btnUploadInvoices.addEventListener('click', async () => {
  const file = invoiceZipInput.files[0];

  if (!file) {
    invoiceUploadMessage.textContent = 'Выберите ZIP-архив';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload-invoices', {
      method: 'POST',
      headers: {
        Authorization: token ? 'Bearer ' + token : ''
      },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Ошибка загрузки архива');
    }

    invoiceUploadMessage.textContent = 'Накладные загружены';
    invoiceZipInput.value = '';
    loadInvoices();
  } catch (err) {
    invoiceUploadMessage.textContent = err.message;
  }
});

// 📋 РЕЕСТРЫ
async function loadRegistries() {
  try {
    const rows = await apiFetch('/api/registries/shipping-lists');

    if (!rows.length) {
      registryList.innerHTML = '<p class="muted">Реестры не найдены</p>';
      return;
    }

    registryList.innerHTML = rows.map(r => `
      <div class="card">
        <h3>ПЛ №${r.number || r.id}</h3>
        <p><b>Дата:</b> ${r.date || '-'}</p>
        <p><b>Склад:</b> ${r.warehouse || '-'}</p>
        <p><b>Строк:</b> ${(r.items || []).length}</p>
      </div>
    `).join('');
  } catch (err) {
    registryList.innerHTML = `<p>${err.message}</p>`;
  }
}

// 🔙 НАЗАД
btnBackMenu.addEventListener('click', () => {
  showModule('menu');
});

// 📌 КНОПКИ МЕНЮ
btnModuleWarehouse.addEventListener('click', () => showModule('warehouse'));
btnModuleReturns.addEventListener('click', () => showModule('returns'));
btnModuleRegistries.addEventListener('click', () => showModule('registries'));

// 📱 АВТОВХОД
if (token && currentUser) {
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  showModule('menu');
}