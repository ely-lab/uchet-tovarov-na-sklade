// 🔐 ЭЛЕМЕНТЫ
const loginScreen = document.getElementById('login-screen');
const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');

const moduleMenu = document.getElementById('module-menu');
const warehouseSection = document.getElementById('warehouse-section');
const returnsSection = document.getElementById('returns-section');
const registriesSection = document.getElementById('registries-section');
const importSection = document.getElementById('import-section');

const inventoryContainer = document.getElementById('inventory');
const searchInput = document.getElementById('search');
const filterBrand = document.getElementById('filter-brand');
const summaryOutput = document.getElementById('summary');

const btnModuleWarehouse = document.getElementById('btn-module-warehouse');
const btnModuleReturns = document.getElementById('btn-module-returns');
const btnModuleRegistries = document.getElementById('btn-module-registries');
const btnModuleImport = document.getElementById('btn-module-import');

const btnLogout = document.getElementById('btn-logout');
const btnAddItem = document.getElementById('btn-add-item');
const btnBackMenu = document.getElementById('btn-back-menu');
const btnInventory = document.getElementById('btn-inventory');
const btnTransfer = document.getElementById('btn-transfer');
const btnScanBarcode = document.getElementById('btn-scan-barcode');
const btnReturnReport = document.getElementById('btn-return-report');

const returnInvoiceList = document.getElementById('return-invoice-list');
const salesInvoiceList = document.getElementById('sales-invoice-list');
const invoiceDetails = null;

const importZipInput = document.getElementById('import-zip-input');
const btnImportZip = document.getElementById('btn-import-zip');
const importMessage = document.getElementById('import-message');
const btnExportZip = document.getElementById('btn-export-zip');

const registryList = document.getElementById('registry-list');

const addSection = document.getElementById('add-section');
const itemForm = document.getElementById('item-form');
const closeModal = document.getElementById('closeModal');

const scannerSection = document.getElementById('scanner-section');
const closeScanner = document.getElementById('closeScanner');
const scannerMessage = document.getElementById('scanner-message');

const returnReportSection = document.getElementById('return-report-section');
const closeReturnReport = document.getElementById('closeReturnReport');
const returnReportForm = document.getElementById('return-report-form');
const reportAgent = document.getElementById('report-agent');
const reportDate = document.getElementById('report-date');
const reportSort = document.getElementById('report-sort');
const returnReportResult = document.getElementById('return-report-result');

const documentModal = document.getElementById('document-modal');
const closeDocumentModal = document.getElementById('closeDocumentModal');
const documentModalContent = document.getElementById('document-modal-content');

const directoryFile = document.getElementById('directory-file');
const directoryType = document.getElementById('directory-type');
const btnImportDirectory = document.getElementById('btn-import-directory');

const API_BASE = 'https://uchet-tovarov-na-sklade.onrender.com';

// 🔑 ДАННЫЕ
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

let items = [];
let salesInvoices = [];
let returnInvoices = [];
let selectedSalesInvoice = null;
let scanner = null;

// 📡 API
async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = 'Bearer ' + localStorage.getItem('token');
  }

  const res = await fetch(API_BASE + url, {
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

    localStorage.setItem('token', res.token);
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
  importSection.classList.toggle('hidden', name !== 'import');

  btnLogout.classList.remove('hidden');
  btnBackMenu.classList.toggle('hidden', name === 'menu');

  btnAddItem.classList.toggle(
    'hidden',
    !(name === 'warehouse' && currentUser && currentUser.role === 'head_office')
  );

  // btnScanBarcode.classList.toggle('hidden', name !== 'warehouse');
  btnInventory.classList.toggle('hidden', name !== 'warehouse');
  btnTransfer.classList.toggle('hidden', name !== 'warehouse');

  btnReturnReport.classList.toggle('hidden', name !== 'returns');

  if (btnModuleImport) {
    btnModuleImport.classList.toggle(
      'hidden',
      !(currentUser && currentUser.role === 'head_office')
    );
  }

  if (name === 'warehouse') {
    loadItems();
  }

  if (name === 'returns') {
    loadReturnsData();
    loadAgents();
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
    applyFilters();
  } catch (err) {
    inventoryContainer.innerHTML = `<p class="muted">${err.message}</p>`;
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

// 🔍 ФИЛЬТРЫ
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

// ➕ ДОБАВЛЕНИЕ ТОВАРА
btnAddItem.addEventListener('click', () => {
  addSection.classList.remove('hidden');
});

closeModal.addEventListener('click', () => {
  addSection.classList.add('hidden');
});

closeDocumentModal.addEventListener('click', () => {
  documentModal.classList.add('hidden');
});

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

// 📷 СКАНЕР ШТРИХКОДА
btnScanBarcode.addEventListener('click', async () => {
  scannerSection.classList.remove('hidden');
  scannerMessage.textContent = 'Запуск камеры...';

  if (!window.Html5Qrcode) {
    scannerMessage.textContent = 'Сканер не загрузился. Проверьте интернет или HTTPS.';
    return;
  }

  try {
    scanner = new Html5Qrcode('barcode-reader');

    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 280, height: 120 }
      },
      (decodedText) => {
        handleScannedBarcode(decodedText);
      }
    );

    scannerMessage.textContent = 'Камера запущена';
  } catch (err) {
    scannerMessage.textContent = 'Не удалось открыть камеру: ' + err;
  }
});

closeScanner.addEventListener('click', stopScanner);

async function stopScanner() {
  scannerSection.classList.add('hidden');

  if (scanner) {
    try {
      await scanner.stop();
      await scanner.clear();
    } catch (err) {
      console.warn(err);
    }
    scanner = null;
  }

  scannerMessage.textContent = '';
}

async function handleScannedBarcode(barcode) {
  await stopScanner();

  searchInput.value = barcode;
  applyFilters();

  const found = items.find(item => String(item.barcode) === String(barcode));

  if (found) {
    alert(`Товар найден: ${found.name}\nОстаток: ${found.quantity} ${found.unit || 'шт'}`);
  } else {
    alert('Товар с таким штрихкодом не найден');
  }
}

// 🔁 ДАННЫЕ ДЛЯ ВОЗВРАТОВ
async function loadReturnsData() {
  try {
    const data = await apiFetch('/api/returns-page-data');

    salesInvoices = data.salesInvoices || [];
    returnInvoices = data.returnInvoices || [];

    renderReturnInvoices();
    renderSalesInvoices();

    selectedSalesInvoice = null;
    //invoiceDetails.innerHTML = '<p class="muted">Документ не выбран</p>';
  } catch (err) {
    returnInvoiceList.innerHTML = `<p class="muted">${err.message}</p>`;
    salesInvoiceList.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

// 📄 СПИСОК ВОЗВРАТНЫХ НАКЛАДНЫХ
function renderReturnInvoices() {
  returnInvoiceList.innerHTML = '';

  if (!returnInvoices.length) {
    returnInvoiceList.innerHTML = '<p class="muted">Накладные возврата не найдены</p>';
    return;
  }

  returnInvoices.forEach(doc => {
    const el = document.createElement('div');
    el.className = 'invoice-card clickable';

    el.innerHTML = `
     <h3>Возврат №${doc.id}</h3>
     <p><b>Покупатель:</b> ${doc.customer || '-'}</p>
     <p><b>Склад:</b> ${doc.warehouse || '-'}</p>
     <p><b>Дата:</b> ${doc.date || '-'}</p>
     <p><b>Позиций:</b> ${(doc.items || []).length}</p>
    `;

    el.addEventListener('click', () => openReturnInvoice(doc.id));

    returnInvoiceList.appendChild(el);
  });
}

// 📄 СПИСОК РАСХОДНЫХ НАКЛАДНЫХ
function renderSalesInvoices() {
  salesInvoiceList.innerHTML = '';

  if (!salesInvoices.length) {
    salesInvoiceList.innerHTML = '<p class="muted">Расходные накладные не найдены</p>';
    return;
  }

  salesInvoices.forEach(doc => {
    const el = document.createElement('div');
    el.className = 'invoice-card clickable';

    el.innerHTML = `
     <h3>Расходная №${doc.id}</h3>
     <p><b>Покупатель:</b> ${doc.customer || '-'}</p>
     <p><b>Склад:</b> ${doc.warehouse || '-'}</p>
     <p><b>Дата:</b> ${doc.date || '-'}</p>
     <p><b>Позиций:</b> ${(doc.items || []).length}</p>
    `;

    el.addEventListener('click', () => openSalesInvoice(doc.id));

    salesInvoiceList.appendChild(el);
  });
}

// 📋 ОТКРЫТЬ ВОЗВРАТНУЮ НАКЛАДНУЮ
function openReturnInvoice(id) {
  const doc = returnInvoices.find(item => String(item.id) === String(id));

  if (!doc) {
    alert('Возвратная накладная не найдена');
    return;
  }

  const rows = (doc.items || []).map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.name || '-'}</td>
      <td>${item.barcode || '-'}</td>
      <td>${item.quantity} ${item.unit || 'шт'}</td>
    </tr>
  `).join('');

  documentModalContent.innerHTML = `
    <div class="invoice-header">
      <h3>Возвратная накладная №${doc.id}</h3>
      <p><b>Покупатель:</b> ${doc.customer || '-'}</p>
      <p><b>Склад:</b> ${doc.warehouse || '-'}</p>
      <p><b>Дата:</b> ${doc.date || '-'}</p>
      <p><b>Основание:</b> расходная накладная №${doc.sourceInvoiceId || '-'}</p>
    </div>

    <div class="table-wrap">
      <table class="return-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Товар</th>
            <th>Штрихкод</th>
            <th>Возвращено</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  documentModal.classList.remove('hidden');
}

// 📋 ОТКРЫТЬ РАСХОДНУЮ НАКЛАДНУЮ
function openSalesInvoice(id) {
  selectedSalesInvoice = salesInvoices.find(item => String(item.id) === String(id));

  if (!selectedSalesInvoice) {
    alert('Расходная накладная не найдена');
    return;
  }

  const rows = (selectedSalesInvoice.items || []).map((item, index) => `
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
          data-brand="${item.brand || ''}"
          data-unit="${item.unit || 'шт'}"
          data-max="${item.quantity}"
          placeholder="0"
        />
      </td>
    </tr>
  `).join('');

  documentModalContent.innerHTML = `
    <div class="invoice-header">
      <h3>Расходная накладная №${selectedSalesInvoice.id}</h3>
      <p><b>Покупатель:</b> ${selectedSalesInvoice.customer || '-'}</p>
      <p><b>Агент:</b> ${selectedSalesInvoice.agent || '-'}</p>
      <p><b>Склад:</b> ${selectedSalesInvoice.warehouse || '-'}</p>
      <p><b>Дата:</b> ${selectedSalesInvoice.date || '-'}</p>
    </div>

    <div class="table-wrap">
      <table class="return-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Товар</th>
            <th>Штрихкод</th>
            <th>В расходной</th>
            <th>Возврат</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <button class="primary return-submit" onclick="submitReturnFromSalesInvoice()">
      Оформить возврат
    </button>
  `;
  documentModal.classList.remove('hidden');
}

// 📋 ОТКРЫТЬ ПОГРУЗОЧНЫЙ ЛИСТ
function openShippingList(doc) {

  const rows = (doc.items || []).map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.name || '-'}</td>
      <td>${item.barcode || '-'}</td>
      <td>${item.quantity} ${item.unit || 'шт'}</td>
    </tr>
  `).join('');

  documentModalContent.innerHTML = `
    <div class="invoice-header">
      <h3>Погрузочный лист №${doc.number || doc.registryNumber || doc.id}</h3>

      <p><b>Дата:</b> ${doc.date || '-'}</p>

      <p><b>Склад:</b> ${doc.warehouse || '-'}</p>

      <p><b>Водитель:</b> ${doc.driver || '-'}</p>
    </div>

    <div class="table-wrap">
      <table class="return-table">

        <thead>
          <tr>
            <th>№</th>
            <th>Товар</th>
            <th>Штрихкод</th>
            <th>Количество</th>
          </tr>
        </thead>

        <tbody>
          ${rows}
        </tbody>

      </table>
    </div>
  `;

  documentModal.classList.remove('hidden');
}

// 🔁 ОФОРМИТЬ ВОЗВРАТ ПО РАСХОДНОЙ НАКЛАДНОЙ
async function submitReturnFromSalesInvoice() {
  if (!selectedSalesInvoice) {
    alert('Выберите расходную накладную');
    return;
  }

  let returnItems;

  try {
    const inputs = document.querySelectorAll('.return-input');

    returnItems = Array.from(inputs)
      .map(input => {
        const quantity = Number(input.value);
        const max = Number(input.dataset.max);

        if (quantity > max) {
          throw new Error(`Нельзя вернуть больше, чем указано в расходной накладной: ${input.dataset.name}`);
        }

        return {
          barcode: input.dataset.barcode,
          name: input.dataset.name,
          brand: input.dataset.brand,
          unit: input.dataset.unit,
          quantity
        };
      })
      .filter(item => item.quantity > 0);
  } catch (err) {
    alert(err.message);
    return;
  }

  if (!returnItems.length) {
    alert('Укажите количество хотя бы для одного товара');
    return;
  }

  try {
    await apiFetch('/api/returns/from-sales-invoice', {
      method: 'POST',
      body: {
        salesInvoiceId: selectedSalesInvoice.id,
        items: returnItems
      }
    });

    alert('Возврат оформлен');
    selectedSalesInvoice = null;
    //invoiceDetails.innerHTML = '<p class="muted">Документ не выбран</p>';
    loadReturnsData();
  } catch (err) {
    alert(err.message);
  }
}

// 📥 ПОКАЗАТЬ ВЫБРАННЫЙ ZIP
importZipInput.addEventListener('change', () => {
  const file = importZipInput.files[0];

  if (file) {
    importMessage.textContent = `Выбран файл: ${file.name}`;
  } else {
    importMessage.textContent = '';
  }
});

// 📥 ИМПОРТ ZIP
btnImportZip.addEventListener('click', async () => {
  const file = importZipInput.files[0];

  if (!file) {
    importMessage.textContent = 'Выберите ZIP-архив';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    importMessage.textContent = 'Загрузка архива...';

    const res = await fetch(API_BASE + '/api/import-1c-zip', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token')
      },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Ошибка импорта');
    }

    const result = await res.json();

    importMessage.textContent =
      `Импорт завершён. Товары: ${result.items || 0}, расходные: ${result.salesInvoices || 0}, возвраты: ${result.returnInvoices || 0}, реестры: ${result.shippingLists || 0}`;

    importZipInput.value = '';
  } catch (err) {
    importMessage.textContent = err.message;
  }
});

// 📤 ЭКСПОРТ ZIP ДЛЯ 1С
btnExportZip.addEventListener('click', async () => {
  try {
    const res = await fetch(API_BASE + '/api/export-1c-zip', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + localStorage.getItem('token')
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Ошибка экспорта');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `export_1c_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();

    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
});

// 📚 ЗАГРУЗКА СПРАВОЧНИКА
btnImportDirectory.addEventListener('click', async () => {

  try {

    const file =
      directoryFile.files[0];

    if (!file) {
      alert('Выберите файл');
      return;
    }

    const formData = new FormData();

    formData.append('file', file);
    formData.append('type', directoryType.value);

    const res = await fetch(
      API_BASE + '/api/import-directory',
      {
        method: 'POST',
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token')
          },
        body: formData
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || 'Ошибка'
      );
    }

    alert(
      `Справочник загружен: ${data.count}`
    );

  } catch (err) {

    alert(err.message);
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

    registryList.innerHTML = '';

    rows.forEach(r => {
      const el = document.createElement('div');
      el.className = 'card clickable';

      el.innerHTML = `
        <h3>ПЛ №${r.number || r.registryNumber || r.id}</h3>
        <p><b>Дата:</b> ${r.date || '-'}</p>
        <p><b>Склад:</b> ${r.warehouse || '-'}</p>
        <p><b>Строк:</b> ${(r.items || []).length}</p>
      `;

      el.addEventListener('click', () => openShippingList(r));

      registryList.appendChild(el);
    });
  } 
  catch (err) {
   registryList.innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

// 👥 АГЕНТЫ
async function loadAgents() {
  try {
    const agents = await apiFetch('/api/agents');

    reportAgent.innerHTML = '<option value="all">Все агенты</option>';

    agents.forEach(agent => {
      const option = document.createElement('option');
      option.value = agent.name || agent;
      option.textContent = agent.name || agent;
      reportAgent.appendChild(option);
    });
  } catch (err) {
    console.warn(err.message);
  }
}

// 📊 ОТЧЁТ ПО ВОЗВРАТАМ
btnReturnReport.addEventListener('click', () => {
  returnReportSection.classList.remove('hidden');

  if (!reportDate.value) {
    reportDate.value = new Date().toISOString().slice(0, 10);
  }
});

closeReturnReport.addEventListener('click', () => {
  returnReportSection.classList.add('hidden');
});

returnReportForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const params = new URLSearchParams({
      agent: reportAgent.value,
      date: reportDate.value,
      sort: reportSort.value
    });

    const rows = await apiFetch(`/api/reports/returns?${params.toString()}`);

    if (!rows.length) {
      returnReportResult.innerHTML = '<p class="muted">Данные для отчёта не найдены</p>';
      return;
    }

    returnReportResult.innerHTML = `
      <h3>Отчёт возврата от покупателя</h3>
      <div class="table-wrap">
        <table class="return-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Агент</th>
              <th>Покупатель</th>
              <th>Товар</th>
              <th>Количество</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${row.date || '-'}</td>
                <td>${row.agent || '-'}</td>
                <td>${row.customer || '-'}</td>
                <td>${row.name || '-'}</td>
                <td>${row.quantity} ${row.unit || 'шт'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    returnReportResult.innerHTML = `<p class="muted">${err.message}</p>`;
  }
});

// 🔙 НАЗАД
btnBackMenu.addEventListener('click', () => {
  showModule('menu');
});

// 📌 КНОПКИ МЕНЮ
btnModuleWarehouse.addEventListener('click', () => showModule('warehouse'));
btnModuleReturns.addEventListener('click', () => showModule('returns'));
btnModuleRegistries.addEventListener('click', () => showModule('registries'));

if (btnModuleImport) {
  btnModuleImport.addEventListener('click', () => {
    if (!currentUser || currentUser.role !== 'head_office') {
      alert('Импорт доступен только администратору');
      return;
    }

    showModule('import');
  });
}

// 📱 АВТОВХОД
if (token && currentUser) {
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  showModule('menu');
}